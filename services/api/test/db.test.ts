import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { migrate } from '../src/db.ts';
import { purgeExpired } from '../src/limits.ts';
import { createEnv, type Env } from './helpers.ts';

let env: Env;
before(async () => { env = await createEnv(); });
after(async () => { await env.close(); });

test('migração é idempotente', async () => {
  assert.deepEqual(await migrate(env.db), []);
});

test('denúncias particionadas por mês, do mês anterior a +3', async () => {
  const { rows } = await env.db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_inherits i JOIN pg_class p ON p.oid = i.inhparent
     WHERE p.relname = 'reports' AND p.relnamespace = current_schema()::regnamespace`,
  );
  assert.equal(rows[0].n, 5);
  await env.db.query('SELECT ensure_report_partitions(3)');
});

test('categorias do banco espelham data/rules/categories.json', async () => {
  const json = JSON.parse(readFileSync(new URL('../../../data/rules/categories.json', import.meta.url), 'utf8'));
  const { rows } = await env.db.query<{ code: number; id: string; severity: string }>('SELECT code, id, severity FROM categories ORDER BY code');
  assert.deepEqual(
    rows.map((r) => ({ code: r.code, id: r.id, severity: Number(r.severity) })),
    json.categories.map((c: { code: number; id: string; severity: number }) => ({ code: c.code, id: c.id, severity: c.severity })),
  );
});

test('retenção: partições antigas saem inteiras (com os comentários)', async () => {
  const dropped = await env.db.query<{ n: number }>('SELECT drop_old_report_partitions(0) AS n');
  assert.equal(dropped.rows[0].n, 1, 'mês anterior removido');
  await env.db.query('SELECT ensure_report_partitions(3)');
});

test('prefixo 0303 semeado como telemarketing', async () => {
  const { rows } = await env.db.query(`SELECT kind, never_block FROM prefixes WHERE prefix = '+55303'`);
  assert.deepEqual(rows[0], { kind: 'TELEMARKETING', never_block: false });
});

test('comentários de denúncia somem após 90 dias', async () => {
  await env.db.query(`CREATE TABLE reports_hist PARTITION OF reports FOR VALUES FROM ('2000-01-01')
    TO ((date_trunc('month', now()) - interval '1 month')::date)`);
  const d = await env.device();
  for (const [number, comment] of [['11981110001', 'antigo'], ['11981110002', 'recente']]) {
    assert.equal((await env.report(d.token, number, 'BANK_SCAM', { comment })).status, 201);
  }
  await env.ageRaw('+5511981110001', 91 * 24);
  await purgeExpired(env.db);
  const { rows } = await env.db.query(`SELECT e164, comment FROM reports WHERE device_id = $1 ORDER BY e164`, [d.id]);
  assert.deepEqual(rows, [{ e164: '+5511981110001', comment: null }, { e164: '+5511981110002', comment: 'recente' }]);
});
