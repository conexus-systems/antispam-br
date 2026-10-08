import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { recomputeStale } from '../src/community.ts';
import { leadingZeroBits, solveChallenge } from '../src/devices.ts';
import { communityReports, createEnv, DEFAULT_IP, MOD, nonce, type Env } from './helpers.ts';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('API comunitária (Postgres real)', () => {
  let env: Env;
  before(async () => { env = await createEnv(); });
  after(async () => { await env.close(); });

  test('healthz e cabeçalhos de segurança', async () => {
    const r = await env.call('GET', '/healthz');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    assert.match(r.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
  });

  test('rotas desconhecidas, método errado, content-type e tamanho', async () => {
    assert.equal((await env.call('GET', '/v1/nada')).status, 404);
    assert.equal((await env.call('DELETE', '/v1/reports')).status, 405);
    const d = await env.device();
    const wrongType = await env.call('POST', '/v1/reports', { token: d.token, headers: { 'content-type': 'text/plain' } });
    assert.equal(wrongType.status, 415);
    const big = await env.report(d.token, '11987654321', 'BANK_SCAM', { comment: 'x'.repeat(20_000) });
    assert.equal(big.status, 413);
  });

  describe('registro de dispositivo com prova de trabalho', () => {
    test('desafio resolvido registra; reuso é recusado', async () => {
      const ch = (await env.call('GET', '/v1/devices/challenge')).body;
      const solution = solveChallenge(ch.challenge, ch.bits);
      const ok = await env.call('POST', '/v1/devices', { body: { challenge: ch.challenge, solution } });
      assert.equal(ok.status, 201);
      assert.match(ok.body.device_token, /^[A-Za-z0-9_-]{43}$/);
      const again = await env.call('POST', '/v1/devices', { body: { challenge: ch.challenge, solution } });
      assert.equal(again.status, 409);
      assert.equal(again.body.error, 'CHALLENGE_REUSED');
    });

    test('trabalho insuficiente e desafio adulterado', async () => {
      const ch = (await env.call('GET', '/v1/devices/challenge')).body;
      let bad = 0;
      while (leadingZeroBits(createHash('sha256').update(`${ch.challenge}:${bad}`).digest()) >= ch.bits) bad++;
      const weak = await env.call('POST', '/v1/devices', { body: { challenge: ch.challenge, solution: String(bad) } });
      assert.equal(weak.body.error, 'INSUFFICIENT_WORK');
      const forged = ch.challenge.replace(/^\d+/, String(Date.now() + 5));
      const res = await env.call('POST', '/v1/devices', { body: { challenge: forged, solution: solveChallenge(forged, ch.bits) } });
      assert.equal(res.body.error, 'INVALID_CHALLENGE');
    });

    test('token é guardado só como hash; IP só como HMAC do prefixo de rede', async () => {
      const d = await env.device({ ip: '203.0.113.99' });
      const { rows } = await env.db.query('SELECT token_sha256, network_hash FROM devices WHERE id = $1', [d.id]);
      assert.deepEqual(rows[0].token_sha256, createHash('sha256').update(d.token).digest());
      assert.match(rows[0].network_hash, /^[0-9a-f]{32}$/);
      const dump = JSON.stringify((await env.db.query('SELECT * FROM devices')).rows);
      assert.ok(!dump.includes('203.0.113') && !dump.includes('10.0.'));
    });

    test('IPv6: reputação agrupa o /32 inteiro (blocos /48 baratos não viram redes novas)', async () => {
      const a = await env.device({ ip: '2001:db8:1::1' });
      const b = await env.device({ ip: '2001:db8:2::1' });
      const c = await env.device({ ip: '2001:db9::1' });
      const { rows } = await env.db.query('SELECT network_hash FROM devices WHERE id = ANY($1) ORDER BY id', [[a.id, b.id, c.id]]);
      assert.equal(rows[0].network_hash, rows[1].network_hash);
      assert.notEqual(rows[0].network_hash, rows[2].network_hash);
    });

    test('X-Forwarded-For: só o hop escrito pelo proxy confiável vale; entradas forjadas à esquerda são ignoradas', async () => {
      const a = await env.device({ ip: '198.51.100.1' });
      const b = await env.device({ ip: '6.6.6.6, 198.51.100.2' });
      const { rows } = await env.db.query('SELECT network_hash FROM devices WHERE id = ANY($1) ORDER BY id', [[a.id, b.id]]);
      assert.equal(rows[0].network_hash, rows[1].network_hash);
    });
  });

  describe('denúncias', () => {
    test('exige token de dispositivo', async () => {
      const r = await env.call('POST', '/v1/reports', { body: { number: '11987654321', category: 'BANK_SCAM' } });
      assert.equal(r.status, 401);
      const bad = await env.call('POST', '/v1/reports', { auth: 'Device ' + 'A'.repeat(43), body: {} });
      assert.equal(bad.body.error, 'DEVICE_TOKEN_INVALID');
    });

    test('emergência em qualquer formato é recusada', async () => {
      const d = await env.device();
      for (const n of ['190', '+55 190', '0190', '55190', '192']) {
        const r = await env.report(d.token, n, 'BANK_SCAM');
        assert.equal(r.status, 422, n);
        assert.equal(r.body.error, 'EMERGENCY_NUMBER', n);
      }
    });

    test('validação de número, categoria e comentário', async () => {
      const d = await env.device();
      assert.equal((await env.report(d.token, 'abc', 'BANK_SCAM')).body.error, 'INVALID_NUMBER');
      assert.equal((await env.report(d.token, '11987654321', 'CRIMINOSO')).body.error, 'INVALID_FIELD');
      assert.equal((await env.report(d.token, '11987654321', 'LEGITIMATE')).body.error, 'USE_LEGITIMATE_ENDPOINT');
      assert.equal((await env.report(d.token, '11987654321', 'BANK_SCAM', { comment: 'x'.repeat(281) })).body.error, 'INVALID_FIELD');
    });

    test('uma denúncia nunca bloqueia nem aparece publicamente', async () => {
      const d = await env.device({ ageDays: 365, agreements: 50 });
      const r = await env.report(d.token, '(11) 98111-0001', 'PIX_SCAM', { comment: 'pediu PIX em nome do banco' });
      assert.equal(r.status, 201);
      assert.equal(r.body.number, '+5511981110001');
      assert.match(r.body.ref, /^[0-9a-z]+\.[A-Za-z0-9_-]{22}$/);
      assert.deepEqual(r.body.reputation, { number: '+5511981110001', published: false, status: 'NOT_LISTED', score: null, label: null });
      assert.equal((await env.internal('+5511981110001')).score, 0);
    });

    test('nonce repetido e timestamp fora da janela são recusados', async () => {
      const d = await env.device();
      const body = { number: '11981110002', category: 'TELEMARKETING', nonce: nonce(), timestamp: Date.now() };
      assert.equal((await env.call('POST', '/v1/reports', { token: d.token, body })).status, 201);
      const replay = await env.call('POST', '/v1/reports', { token: d.token, body });
      assert.equal(replay.status, 409);
      assert.equal(replay.body.error, 'REPLAY');
      const stale = await env.report(d.token, '11981110002', 'TELEMARKETING', { timestamp: Date.now() - 3_600_000 });
      assert.equal(stale.body.error, 'STALE_REQUEST');
    });

    test('mesmo dispositivo denunciando 5× conta como 1', async () => {
      const d = await env.device({ ageDays: 120 });
      for (let i = 0; i < 5; i++) assert.equal((await env.report(d.token, '11981110003', 'BANK_SCAM')).status, 201);
      const rep = await env.internal('+5511981110003');
      assert.equal(rep.distinct_reporters, 1);
      assert.equal(rep.score, 0);
    });

    test('denúncias concorrentes no mesmo número não se perdem', async () => {
      const devices = await Promise.all(Array.from({ length: 8 }, () => env.device({ ageDays: 120 })));
      const res = await Promise.all(devices.map((d) => env.report(d.token, '11981110004', 'ROBOCALL')));
      assert.ok(res.every((r) => r.status === 201));
      assert.equal((await env.internal('+5511981110004')).distinct_reporters, 8);
    });
  });

  describe('reputação comunitária ponta a ponta', () => {
    test('cinco denunciantes maduros em redes distintas há 3 dias → SPAM publicado; consulta em qualquer formato', async () => {
      await communityReports(env, '+5511982220001', 'BANK_SCAM', 5);
      for (const f of ['11982220001', '+5511982220001', '(11) 98222-0001', '011982220001']) {
        const rep = (await env.call('GET', `/v1/numbers/${encodeURIComponent(f)}/reputation`)).body;
        assert.equal(rep.number, '+5511982220001', f);
        assert.equal(rep.label, 'SPAM', f);
        assert.equal(rep.published, true, f);
      }
    });

    test('score alto com menos de 48 h: consulta pública neutra (não difama nem revela denúncia)', async () => {
      await communityReports(env, '+5511982220002', 'BANK_SCAM', 5, 6);
      assert.ok((await env.internal('+5511982220002')).score >= 60);
      const pub = (await env.call('GET', '/v1/numbers/11982220002/reputation')).body;
      assert.equal(pub.status, 'NOT_LISTED');
      assert.equal(pub.score, null);
      const never = (await env.call('GET', '/v1/numbers/11982229999/reputation')).body;
      assert.deepEqual(Object.keys(pub).sort(), Object.keys(never).sort());
    });

    test('a resposta pública não expõe comentários nem dispositivos', async () => {
      const d = await env.device({ ageDays: 120 });
      await env.report(d.token, '11982220001', 'BANK_SCAM', { comment: 'SEGREDO-DO-DENUNCIANTE' });
      const r = await env.call('GET', '/v1/numbers/11982220001/reputation');
      const text = r.raw.toString('utf8');
      assert.ok(!text.includes('SEGREDO'));
      assert.ok(!/device/i.test(text));
    });

    test('hash-prefix devolve só publicados e só o balde pedido', async () => {
      const h = sha('+5511982220001');
      const r = await env.call('GET', `/v1/reputation/hash-prefix/${h.slice(0, 5)}`);
      assert.equal(r.status, 200);
      assert.ok(r.body.entries.some((e: { sha256: string }) => e.sha256 === h));
      assert.ok(r.body.entries.every((e: { sha256: string }) => e.sha256.startsWith(h.slice(0, 5))));
      const unpublished = sha('+5511982220002');
      const r2 = await env.call('GET', `/v1/reputation/hash-prefix/${unpublished.slice(0, 5)}`);
      assert.ok(!r2.body.entries.some((e: { sha256: string }) => e.sha256 === unpublished));
      assert.equal((await env.call('GET', '/v1/reputation/hash-prefix/ABCDE')).status, 400);
      assert.equal((await env.call('GET', '/v1/reputation/hash-prefix/abcdef')).status, 400);
    });

    test('número de emergência na consulta: nunca bloqueado', async () => {
      assert.equal((await env.call('GET', '/v1/numbers/190/reputation')).body.status, 'NEVER_BLOCK');
    });

    test('surto de dispositivos novos fica em quarentena', async () => {
      const devices = await Promise.all(Array.from({ length: 12 }, () => env.device({ ageDays: 1 })));
      for (const d of devices) await env.report(d.token, '11982220003', 'BANK_SCAM');
      await env.age('+5511982220003', 72);
      const rep = await env.internal('+5511982220003');
      assert.equal(rep.burst_quarantine, true);
      assert.equal(rep.publishable, false);
    });

    test('Sybil numa rede: 13 dispositivos novos numa /24, espaçados, não publicam', async () => {
      for (let i = 0; i < 13; i++) {
        const d = await env.device({ ip: `100.64.7.${i + 1}` });
        await env.report(d.token, '11982220005', 'BANK_SCAM');
        await env.db.query(`UPDATE reports SET created_at = created_at - make_interval(mins => $1) WHERE device_id = $2`, [20 * i, d.id]);
      }
      await env.age('+5511982220005', 50);
      const rep = await env.internal('+5511982220005');
      assert.equal(rep.publishable, false);
      assert.equal(rep.score, 0);
    });

    test('Sybil espalhado: dispositivos novos em redes distintas não publicam', async () => {
      for (let i = 0; i < 13; i++) {
        const d = await env.device({ ageDays: 1 });
        await env.report(d.token, '11982220006', 'BANK_SCAM');
        await env.db.query(`UPDATE reports SET created_at = created_at - make_interval(mins => $1) WHERE device_id = $2`, [20 * i, d.id]);
      }
      await env.age('+5511982220006', 50);
      const rep = await env.internal('+5511982220006');
      assert.equal(rep.publishable, false);
      assert.ok(rep.blocked_by.includes('YOUNG_REPORTERS'));
    });

    test('dispositivo acima do p99 diário da frota perde o peso no dia', async () => {
      const reporters = await communityReports(env, '+5511982220008', 'BANK_SCAM', 5);
      assert.equal((await env.internal('+5511982220008')).publishable, true);
      await env.db.query(`INSERT INTO fleet_stats (key, value) VALUES ('device_daily_actions_p99', 2)
                          ON CONFLICT (key) DO UPDATE SET value = 2`);
      for (const d of reporters.slice(0, 3)) {
        await env.db.query(
          `INSERT INTO rate_counters (key, window_start, count)
           VALUES ($1, to_timestamp(floor(extract(epoch FROM now()) / 86400) * 86400), 15)
           ON CONFLICT (key, window_start) DO UPDATE SET count = 15`,
          [`act:dev:${d.id}:d`],
        );
      }
      await env.recompute('+5511982220008');
      assert.equal((await env.internal('+5511982220008')).publishable, false);
      await env.db.query(`DELETE FROM fleet_stats`);
    });

    test('dispositivos com histórico ruim quase não pesam', async () => {
      for (let i = 0; i < 8; i++) {
        const d = await env.device({ ageDays: 300, disagreements: 10 });
        await env.report(d.token, '11982220004', 'BANK_SCAM');
      }
      await env.age('+5511982220004', 72);
      const rep = await env.internal('+5511982220004');
      assert.equal(rep.score, 0);
      assert.equal(rep.publishable, false);
    });

    test('o tempo sozinho muda o estado: 48 h vencem e a rotina periódica publica', async () => {
      await communityReports(env, '+5511982220007', 'PHISHING', 5, 1);
      assert.equal((await env.internal('+5511982220007')).publishable, false);
      await env.ageRaw('+5511982220007', 72);
      await env.db.query(`UPDATE reputations SET updated_at = now() - interval '7 hours' WHERE e164 = '+5511982220007'`);
      assert.ok(await recomputeStale(env.db, env.config) >= 1);
      assert.equal((await env.internal('+5511982220007')).publishable, true);
    });
  });

  describe('votos, contestação e moderação', () => {
    const vote = (token: string, ref: string, v: string) =>
      env.call('POST', `/v1/reports/${encodeURIComponent(ref)}/vote`, { token, body: { vote: v, nonce: nonce(), timestamp: Date.now() } });

    test('voto por referência opaca: não confirma a própria; id sequencial não é aceito; resposta não revela o número', async () => {
      const [a] = await communityReports(env, '+5511983330001', 'PIX_SCAM', 2);
      assert.equal((await vote(a.token, a.ref, 'confirm')).body.error, 'OWN_REPORT');
      const b = await env.device({ ageDays: 120 });
      const ok = await vote(b.token, a.ref, 'confirm');
      assert.equal(ok.status, 200);
      assert.deepEqual(ok.body, { vote: 'recorded' });
      assert.equal((await env.internal('+5511983330001')).distinct_reporters, 3);
      const numericId = a.ref.split('.')[0];
      assert.equal((await vote(b.token, String(parseInt(numericId, 36)), 'confirm')).status, 404);
      assert.equal((await vote(b.token, `${numericId}.${'A'.repeat(22)}`, 'confirm')).status, 404);
      assert.equal((await env.call('POST', `/v1/reports/${a.ref}/vote`, { token: b.token, body: { vote: 'like' } })).status, 400);
    });

    test('contestação de dispositivo novo não tira número publicado da base', async () => {
      const [a] = await communityReports(env, '+5511983330002', 'BANK_SCAM', 5);
      const fresh = await env.device();
      assert.equal((await vote(fresh.token, a.ref, 'dispute')).status, 200);
      assert.equal((await env.call('GET', '/v1/numbers/11983330002/reputation')).body.published, true);
      const { rows } = await env.db.query(`SELECT weight FROM contests WHERE e164 = '+5511983330002'`);
      assert.ok(rows[0].weight < 0.5);
    });

    test('várias contestações de dispositivos novos (mesma rede ou redes distintas) não tiram o número da base', async () => {
      await communityReports(env, '+5511983330008', 'BANK_SCAM', 6);
      for (let i = 0; i < 2; i++) {
        const d = await env.device({ ip: `198.51.100.${i + 40}` });
        assert.equal((await env.legitimate(d.token, '+5511983330008')).status, 201);
      }
      for (let i = 0; i < 5; i++) {
        const d = await env.device();
        assert.equal((await env.legitimate(d.token, '+5511983330008')).status, 201);
      }
      const pub = (await env.call('GET', '/v1/numbers/11983330008/reputation')).body;
      assert.equal(pub.status, 'LISTED');
      const { rows } = await env.db.query(`SELECT count(*)::int AS n FROM contests WHERE e164 = '+5511983330008' AND status = 'PENDING'`);
      assert.equal(rows[0].n, 7, 'todas vão para a fila de moderação');
    });

    test('contas pré-envelhecidas por uma semana em redes distintas não suspendem a publicação', async () => {
      await communityReports(env, '+5511983330009', 'BANK_SCAM', 5);
      for (let i = 0; i < 3; i++) {
        const d = await env.device({ ageDays: 8 });
        assert.equal((await env.legitimate(d.token, '+5511983330009')).status, 201);
      }
      assert.equal((await env.call('GET', '/v1/numbers/11983330009/reputation')).body.status, 'LISTED');
      assert.deepEqual((await env.internal('+5511983330009')).blocked_by, []);
    });

    test('contestação de dispositivo maduro suspende a publicação até a moderação', async () => {
      await communityReports(env, '+5511983330006', 'BANK_SCAM', 5);
      const mature = await env.device({ ageDays: 90 });
      assert.equal((await env.legitimate(mature.token, '+5511983330006')).status, 201);
      assert.equal((await env.call('GET', '/v1/numbers/11983330006/reputation')).body.published, false);
      assert.ok((await env.internal('+5511983330006')).blocked_by.includes('PENDING_CONTEST'));
    });

    test('dispositivo em quarentena não abre fila de moderação', async () => {
      await communityReports(env, '+5511983330007', 'BANK_SCAM', 5);
      const q = await env.device({ ageDays: 200 });
      await env.db.query(`UPDATE devices SET quarantined_at = now() WHERE id = $1`, [q.id]);
      assert.equal((await env.legitimate(q.token, '+5511983330007')).status, 201);
      const { rows } = await env.db.query(`SELECT count(*)::int AS n FROM contests WHERE e164 = '+5511983330007'`);
      assert.equal(rows[0].n, 0);
      assert.equal((await env.internal('+5511983330007')).publishable, true);
    });

    test('moderação exige token; ACCEPT limpa o número, ajusta precisão e protege por 90 dias', async () => {
      const reporters = await communityReports(env, '+5511983330003', 'BANK_SCAM', 5);
      const owner = await env.device({ ageDays: 30 });
      const contest = await env.legitimate(owner.token, '+5511983330003', 'é o número da minha clínica');
      assert.equal(contest.status, 201);

      assert.equal((await env.call('GET', '/v1/moderation/contests')).status, 401);
      assert.equal((await env.call('GET', '/v1/moderation/contests', { auth: 'Bearer errado' })).status, 401);
      const list = await env.call('GET', '/v1/moderation/contests', { auth: MOD });
      const item = list.body.contests.find((c: { number: string }) => c.number === '+5511983330003');
      assert.ok(item);
      assert.ok(Array.isArray(item.recent_report_comments));

      const decision = await env.call('POST', `/v1/moderation/contests/${item.id}/decision`, {
        auth: MOD, body: { decision: 'ACCEPT', reason: 'CNPJ e site conferidos', moderator: 'outra-pessoa' },
      });
      assert.equal(decision.status, 200);
      assert.equal(decision.body.reputation.published, false);
      assert.equal((await env.internal('+5511983330003')).score, 0);

      const { rows } = await env.db.query('SELECT disagreements FROM devices WHERE id = ANY($1)', [reporters.map((r) => r.id)]);
      assert.ok(rows.every((r: { disagreements: number }) => r.disagreements === 1));
      assert.equal((await env.db.query('SELECT agreements FROM devices WHERE id = $1', [owner.id])).rows[0].agreements, 1);
      const { rows: log } = await env.db.query(`SELECT moderator FROM moderation_decisions WHERE subject_id = $1`, [String(item.id)]);
      assert.equal(log[0].moderator, 'tiago', 'nome vem do token, não do corpo');

      const again = await env.call('POST', `/v1/moderation/contests/${item.id}/decision`, {
        auth: MOD, body: { decision: 'REJECT', reason: 'tentativa dupla' },
      });
      assert.equal(again.status, 409);

      // Denúncias novas DEPOIS da decisão, já com 72 h, não reativam o bloqueio durante a proteção…
      await env.db.query(`UPDATE contests SET decided_at = decided_at - interval '100 hours' WHERE e164 = '+5511983330003'`);
      await env.db.query(`UPDATE reports SET created_at = created_at - interval '100 hours' WHERE e164 = '+5511983330003'`);
      for (let i = 0; i < 5; i++) {
        const d = await env.device({ ageDays: 120 });
        await env.report(d.token, '+5511983330003', 'BANK_SCAM');
      }
      await env.db.query(`UPDATE reports SET created_at = now() - interval '72 hours' WHERE e164 = '+5511983330003' AND created_at > now() - interval '1 hour'`);
      await env.recompute('+5511983330003');
      const protectedRep = await env.internal('+5511983330003');
      assert.equal(protectedRep.distinct_reporters, 5, 'as denúncias novas contam…');
      assert.equal(protectedRep.publishable, false, '…mas a proteção segura a publicação');
      assert.ok(protectedRep.blocked_by.includes('CONTEST_ACCEPTED'));

      // …e depois dos 90 dias a rotina periódica (sem evento novo) devolve o número à base.
      await env.db.query(`UPDATE contests SET decided_at = now() - interval '91 days' WHERE e164 = '+5511983330003'`);
      await recomputeStale(env.db, env.config, new Date(Date.now() + 60_000));
      assert.equal((await env.internal('+5511983330003')).publishable, true);
    });

    test('REJECT libera a publicação, pune contestantes e não infla denunciantes', async () => {
      const reporters = await communityReports(env, '+5511983330004', 'FAKE_SUPPORT', 6);
      const owner = await env.device({ ageDays: 60 });
      await env.legitimate(owner.token, '+5511983330004');
      const { rows } = await env.db.query(`SELECT id FROM contests WHERE e164 = '+5511983330004'`);
      const r = await env.call('POST', `/v1/moderation/contests/${rows[0].id}/decision`, {
        auth: MOD, body: { decision: 'REJECT', reason: 'golpe confirmado por várias vítimas' },
      });
      assert.equal(r.body.status, 'REJECTED');
      assert.equal(r.body.reputation.published, true);
      assert.equal((await env.db.query('SELECT disagreements FROM devices WHERE id = $1', [owner.id])).rows[0].disagreements, 1);
      const { rows: rep } = await env.db.query('SELECT agreements FROM devices WHERE id = ANY($1)', [reporters.map((x) => x.id)]);
      assert.ok(rep.every((x: { agreements: number }) => x.agreements === 0));
    });

    test('quarentena de dispositivo zera seu peso e recalcula', async () => {
      const reporters = await communityReports(env, '+5511983330005', 'LOAN', 7);
      assert.equal((await env.internal('+5511983330005')).publishable, true);
      const before = (await env.internal('+5511983330005')).score;
      for (const d of reporters.slice(0, 5)) {
        const r = await env.call('POST', `/v1/moderation/devices/${d.id}/quarantine`, { auth: MOD, body: { reason: 'fazenda de bots' } });
        assert.equal(r.status, 200);
      }
      const after = await env.internal('+5511983330005');
      assert.ok(after.score < before);
      assert.equal(after.publishable, false);
    });
  });
});

describe('limites de taxa', () => {
  let env: Env;
  before(async () => {
    env = await createEnv({
      limits: { deviceActionsPerMinute: 3, networkRegistrationsPerDay: 3, deviceContestsPerDay: 1, networkAuthFailuresPerMinute: 2 },
      moderation: false,
    });
  });
  after(async () => { await env.close(); });

  test('dispositivo: 4ª ação no minuto recebe 429 com Retry-After', async () => {
    const d = await env.device();
    for (let i = 0; i < 3; i++) assert.equal((await env.report(d.token, `1198444000${i}`, 'SURVEY')).status, 201);
    const r = await env.report(d.token, '11984440009', 'SURVEY');
    assert.equal(r.status, 429);
    assert.ok(Number(r.headers.get('retry-after')) >= 1);
  });

  test('contestação tem limite próprio por dispositivo', async () => {
    const d = await env.device();
    assert.equal((await env.legitimate(d.token, '11984440100')).status, 201);
    assert.equal((await env.legitimate(d.token, '11984440101')).status, 429);
  });

  test('rede: registros por /24 limitados; outra rede segue livre', async () => {
    await env.device({ ip: '192.0.2.10' });
    await env.device({ ip: '192.0.2.11' });
    await env.device({ ip: '192.0.2.12' });
    await assert.rejects(env.device({ ip: '192.0.2.13' }), /RATE_LIMITED/);
    await env.device({ ip: '192.0.3.10' });
  });

  test('tokens inválidos por rede são limitados (força bruta)', async () => {
    const bad = () => env.call('POST', '/v1/reports', { ip: DEFAULT_IP, auth: 'Device ' + 'B'.repeat(43), body: {} });
    assert.equal((await bad()).status, 401);
    assert.equal((await bad()).status, 401);
    assert.equal((await bad()).status, 429);
  });

  test('moderação desligada sem token configurado', async () => {
    assert.equal((await env.call('GET', '/v1/moderation/contests', { auth: MOD })).status, 404);
  });
});

describe('IP do cliente atrás da borda', () => {
  let env: Env;
  before(async () => { env = await createEnv({ config: { trustProxyHops: 2, clientIpHeader: 'cf-connecting-ip' } }); });
  after(async () => { await env.close(); });

  test('cabeçalho da borda tem prioridade; sem ele vale o hop N a partir da direita', async () => {
    const a = await env.device({ ip: '1.1.1.1, 172.16.0.1', });
    const b = await env.device({ ip: '9.9.9.9, 172.16.0.1' });
    const c = await env.call('GET', '/v1/devices/challenge');
    assert.equal(c.status, 200);
    const { rows } = await env.db.query('SELECT network_hash FROM devices WHERE id = ANY($1) ORDER BY id', [[a.id, b.id]]);
    assert.notEqual(rows[0].network_hash, rows[1].network_hash, 'hop 2 da direita = IP real do cliente');
  });
});

describe('portal web', () => {
  let env: Env;
  before(async () => { env = await createEnv({ web: true }); });
  after(async () => { await env.close(); });

  test('serve index.html, normalize.js e app.js com CSP sem script inline', async () => {
    const html = await env.call('GET', '/');
    assert.equal(html.status, 200);
    assert.match(html.headers.get('content-type') ?? '', /text\/html/);
    assert.ok(!/<script>/.test(html.raw.toString('utf8')), 'nenhum script inline');
    assert.match(html.headers.get('content-security-policy') ?? '', /script-src 'self';/);
    for (const f of ['/app.js', '/normalize.js']) {
      const js = await env.call('GET', f);
      assert.match(js.headers.get('content-type') ?? '', /javascript/, f);
      assert.ok(!js.raw.toString('utf8').includes('innerHTML'), `${f}: saída só por DOM/textContent`);
    }
  });
});
