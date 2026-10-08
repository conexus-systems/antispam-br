import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPublicKey } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import {
  decodeShard, Flags, privateKeyFromSeed, rawPublicKey, ShardKind, verifyManifest, type Manifest,
} from '@antispam-br/datasets';
import { publishDataset } from '../src/datasets.ts';
import { communityReports, createEnv, MOD, type Env } from './helpers.ts';

const seed = createHash('sha256').update('antispam-br api test key').digest();
const privateKey = privateKeyFromSeed(seed);
const trusted = { 'test-1': rawPublicKey(createPublicKey(privateKey)) };

describe('publicação de dataset a partir do banco', () => {
  let env: Env;
  before(async () => { env = await createEnv(); });
  after(async () => { await env.close(); });

  test('sem versão publicada → 404', async () => {
    assert.equal((await env.call('GET', '/v1/datasets/manifest')).status, 404);
  });

  test('publica só números publicáveis, assinado e verificável pelo cliente', async () => {
    await communityReports(env, '+5511985550001', 'BANK_SCAM', 6);
    await communityReports(env, '+5521985550002', 'TELEMARKETING', 9);
    await communityReports(env, '+5511985550003', 'PIX_SCAM', 1); // insuficiente
    await communityReports(env, '+5511985550004', 'BANK_SCAM', 5, 6); // recente demais

    const out = await publishDataset(env.db, env.config, { privateKey, keyId: 'test-1', now: new Date() });
    assert.equal(out.record_count, 2);

    const manifest = await env.call('GET', '/v1/datasets/manifest');
    const sig = await env.call('GET', '/v1/datasets/manifest.sig');
    const v = verifyManifest(manifest.raw, sig.raw.toString('utf8'), trusted);
    assert.ok(v.ok, JSON.stringify(v));
    const m = (v as { manifest: Manifest }).manifest;
    assert.equal(m.version, out.version);

    const numbers: bigint[] = [];
    for (const shard of m.shards) {
      const file = await env.call('GET', `/v1/datasets/${m.version}/${shard.path}`);
      assert.equal(file.status, 200);
      assert.equal(createHash('sha256').update(file.raw).digest('hex'), shard.sha256);
      const decoded = decodeShard(gunzipSync(file.raw));
      for (const r of decoded.records) {
        numbers.push(r.number);
        assert.ok(r.score >= 60);
        assert.ok(r.reporters >= 5);
      }
    }
    assert.deepEqual(numbers.sort(), [5511985550001n, 5521985550002n]);

    const index = await env.call('GET', `/v1/datasets/${m.version}`);
    assert.equal(index.body.files.length, m.shards.length);
    assert.equal((await env.call('GET', `/v1/datasets/${m.version}/brazil/..%2F..%2Fetc`)).status, 404);
    assert.equal((await env.call('GET', '/v1/datasets/abc')).status, 404);
  });

  test('chave errada é recusada pelo verificador', async () => {
    const manifest = await env.call('GET', '/v1/datasets/manifest');
    const sig = await env.call('GET', '/v1/datasets/manifest.sig');
    const otherKey = rawPublicKey(createPublicKey(privateKeyFromSeed(createHash('sha256').update('outra').digest())));
    assert.equal(verifyManifest(manifest.raw, sig.raw.toString('utf8'), { 'test-1': otherKey }).ok, false);
  });

  test('contestação aceita → próxima versão traz tombstone no delta; versões monotônicas', async () => {
    const first = (await env.call('GET', '/v1/datasets/manifest')).body as Manifest;
    const owner = await env.device({ ageDays: 60 });
    await env.legitimate(owner.token, '11985550001');
    const { rows } = await env.db.query(`SELECT id FROM contests WHERE e164 = '+5511985550001'`);
    await env.call('POST', `/v1/moderation/contests/${rows[0].id}/decision`, {
      auth: MOD, body: { decision: 'ACCEPT', reason: 'empresa verificada' },
    });

    const out = await publishDataset(env.db, env.config, { privateKey, keyId: 'test-1' });
    assert.ok(out.version > first.version);
    assert.equal(out.record_count, 1);

    const manifest = await env.call('GET', '/v1/datasets/manifest');
    const sig = await env.call('GET', '/v1/datasets/manifest.sig');
    const v = verifyManifest(manifest.raw, sig.raw.toString('utf8'), trusted, { installedVersion: first.version });
    assert.ok(v.ok);
    const m = (v as { manifest: Manifest }).manifest;
    const delta = m.deltas.find((d) => d.shard === '55-11');
    assert.ok(delta);
    assert.equal(delta.from_version, first.version);
    const decoded = decodeShard(gunzipSync((await env.call('GET', `/v1/datasets/${m.version}/${delta.path}`)).raw));
    assert.equal(decoded.kind, ShardKind.DELTA);
    const tomb = decoded.records.find((r) => r.number === 5511985550001n);
    assert.ok(tomb && tomb.flags & Flags.TOMBSTONE);

    // anti-rollback do cliente: a versão antiga não é aceita depois da nova
    const old = await env.call('GET', `/v1/datasets/${first.version}/manifest.json`);
    const oldSig = await env.call('GET', `/v1/datasets/${first.version}/manifest.json.sig`);
    const r = verifyManifest(old.raw, oldSig.raw.toString('utf8'), trusted, { installedVersion: m.version });
    assert.deepEqual(r, { ok: false, reason: 'ROLLBACK' });
  });

  test('campanha: 3+ números suspeitos no mesmo bloco aparecem mascarados', async () => {
    for (const n of ['+5511986660101', '+5511986660202', '+5511986660303']) await communityReports(env, n, 'DELIVERY_SCAM', 5);
    await publishDataset(env.db, env.config, { privateKey, keyId: 'test-1' });
    const r = await env.call('GET', '/v1/campaigns');
    const c = r.body.campaigns.find((x: { pattern: string }) => x.pattern === '+551198666XXXX');
    assert.ok(c, JSON.stringify(r.body));
    assert.equal(c.numbers, 3);
    assert.equal(c.category, 'DELIVERY_SCAM');
    assert.ok(!r.raw.toString('utf8').includes('11986660101'));
  });

  test('publicação recalcula pelo relógio: 48 h vencidas entram; denúncias antigas decaem e saem (tombstone)', async () => {
    await communityReports(env, '+5511987770001', 'BANK_SCAM', 5, 1);
    await communityReports(env, '+5511987770002', 'PIX_SCAM', 6);
    const first = await publishDataset(env.db, env.config, { privateKey, keyId: 'test-1' });
    const firstManifest = (await env.call('GET', '/v1/datasets/manifest')).body as Manifest;
    const numbersIn = async (m: Manifest) => {
      const out: bigint[] = [];
      for (const s of m.shards) out.push(...decodeShard(gunzipSync((await env.call('GET', `/v1/datasets/${m.version}/${s.path}`)).raw)).records.map((r) => r.number));
      return out;
    };
    assert.ok(!(await numbersIn(firstManifest)).includes(5511987770001n));
    assert.ok((await numbersIn(firstManifest)).includes(5511987770002n));

    // só o tempo passa — nenhum evento novo nos números (partição histórica recebe as linhas envelhecidas)
    await env.db.query(`CREATE TABLE reports_hist PARTITION OF reports FOR VALUES FROM ('2000-01-01')
      TO ((date_trunc('month', now()) - interval '1 month')::date)`);
    await env.ageRaw('+5511987770001', 72);
    await env.ageRaw('+5511987770002', 200 * 24);
    const second = await publishDataset(env.db, env.config, { privateKey, keyId: 'test-1' });
    assert.ok(second.version > first.version);
    const m = (await env.call('GET', '/v1/datasets/manifest')).body as Manifest;
    const now = await numbersIn(m);
    assert.ok(now.includes(5511987770001n), 'janela de 48 h venceu');
    assert.ok(!now.includes(5511987770002n), 'decaiu após 200 dias');
    const delta = m.deltas.find((d) => d.shard === '55-11')!;
    const tomb = decodeShard(gunzipSync((await env.call('GET', `/v1/datasets/${m.version}/${delta.path}`)).raw)).records
      .find((r) => r.number === 5511987770002n);
    assert.ok(tomb && tomb.flags & Flags.TOMBSTONE);
  });
});
