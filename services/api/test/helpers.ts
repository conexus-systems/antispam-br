import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import pg from 'pg';
import { recompute } from '../src/community.ts';
import { DEFAULT_LIMITS, type Config, type Limits } from '../src/config.ts';
import { createPool, migrate, withTx, type Db } from '../src/db.ts';
import { solveChallenge } from '../src/devices.ts';
import { buildServer } from '../src/server.ts';

export const DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://antispam:antispam-dev-only@127.0.0.1:5544/antispam';
export const MODERATION_TOKEN = 'test-moderation-token-0123456789abcdef';
export const MOD = `Bearer ${MODERATION_TOKEN}`;
export const DEFAULT_IP = '203.0.113.7';

type Response = { status: number; body: any; headers: Headers; raw: Buffer };

export interface Env {
  base: string;
  db: Db;
  config: Config;
  close(): Promise<void>;
  call(method: string, path: string, opts?: { body?: unknown; token?: string; auth?: string; ip?: string; headers?: Record<string, string> }): Promise<Response>;
  /** Registra um dispositivo; `ip` define a rede (padrão: uma /24 nova a cada chamada). */
  device(opts?: { ageDays?: number; agreements?: number; disagreements?: number; ip?: string }): Promise<{ id: number; token: string }>;
  report(token: string, number: string, category: string, extra?: Record<string, unknown>): Promise<Response>;
  legitimate(token: string, number: string, comment?: string): Promise<Response>;
  /** Move denúncias do número para o passado SEM recalcular (como o tempo passa em produção). */
  ageRaw(e164: string, hours: number): Promise<void>;
  /** ageRaw + recálculo. */
  age(e164: string, hours: number): Promise<void>;
  recompute(e164: string): Promise<void>;
  /** Linha interna de reputations (visão da moderação, não pública). */
  internal(e164: string): Promise<any>;
}

let nonceSeq = 0;
export const nonce = () => `n${Date.now().toString(36)}${(nonceSeq++).toString(36)}${randomBytes(6).toString('hex')}`;
let netSeq = 0;
const freshIp = () => { netSeq++; return `10.${(netSeq >> 8) & 255}.${netSeq & 255}.9`; };

export async function createEnv(overrides: { limits?: Partial<Limits>; moderation?: boolean; web?: boolean; config?: Partial<Config> } = {}): Promise<Env> {
  const schema = `t_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();

  const db = createPool(DATABASE_URL, { options: `-c search_path=${schema}`, max: 20 });
  await migrate(db);
  const config: Config = {
    port: 0,
    databaseUrl: DATABASE_URL,
    serverSecret: Buffer.from('test-server-secret-0123456789abcdef-xyz'),
    powBits: 6,
    moderators: overrides.moderation === false ? new Map() : new Map([[MODERATION_TOKEN, 'tiago']]),
    trustProxyHops: 1,
    clientIpHeader: null,
    webDir: overrides.web ? new URL('../../../apps/web/', import.meta.url).pathname : null,
    clockSkewMs: 10 * 60_000,
    contestSuspendWeight: 0.5,
    limits: {
      ...DEFAULT_LIMITS, deviceActionsPerMinute: 1000, deviceActionsPerDay: 1000, deviceContestsPerDay: 1000,
      networkActionsPerDay: 10_000, networkContestsPerDay: 10_000, networkRegistrationsPerDay: 10_000,
      networkLookupsPerMinute: 10_000, networkAuthFailuresPerMinute: 10_000, ...overrides.limits,
    },
    ...overrides.config,
  };
  const server = buildServer(config, db, () => {});
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const call: Env['call'] = async (method, path, opts = {}) => {
    const headers: Record<string, string> = { 'x-forwarded-for': opts.ip ?? DEFAULT_IP, ...opts.headers };
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (opts.token) headers.authorization = `Device ${opts.token}`;
    if (opts.auth) headers.authorization = opts.auth;
    const res = await fetch(base + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    const raw = Buffer.from(await res.arrayBuffer());
    let body: any = null;
    if ((res.headers.get('content-type') ?? '').includes('json')) body = JSON.parse(raw.toString('utf8'));
    return { status: res.status, body, headers: res.headers, raw };
  };

  const device: Env['device'] = async (o = {}) => {
    const ip = o.ip ?? freshIp();
    const ch = (await call('GET', '/v1/devices/challenge', { ip })).body;
    const res = await call('POST', '/v1/devices', { ip, body: { challenge: ch.challenge, solution: solveChallenge(ch.challenge, ch.bits) } });
    if (res.status !== 201) throw new Error(`registro falhou: ${JSON.stringify(res.body)}`);
    const { rows } = await db.query<{ id: string }>('SELECT max(id) AS id FROM devices');
    const id = Number(rows[0].id);
    await db.query(
      `UPDATE devices SET created_at = now() - make_interval(days => $2), agreements = $3, disagreements = $4 WHERE id = $1`,
      [id, o.ageDays ?? 0, o.agreements ?? 0, o.disagreements ?? 0],
    );
    return { id, token: res.body.device_token };
  };

  const report: Env['report'] = (token, number, category, extra = {}) =>
    call('POST', '/v1/reports', { token, body: { number, category, nonce: nonce(), timestamp: Date.now(), ...extra } });
  const legitimate: Env['legitimate'] = (token, number, comment) =>
    call('POST', `/v1/numbers/${encodeURIComponent(number)}/legitimate`, { token, body: { nonce: nonce(), timestamp: Date.now(), comment } });

  const recomputeNumber = (e164: string) => withTx(db, async (tx) => { await recompute(tx, config, e164); });
  const ageRaw = async (e164: string, hours: number) => {
    await db.query(`UPDATE reports SET created_at = created_at - make_interval(hours => $2) WHERE e164 = $1`, [e164, hours]);
  };

  return {
    base, db, config, call, device, report, legitimate, ageRaw,
    recompute: recomputeNumber,
    async age(e164, hours) {
      await ageRaw(e164, hours);
      await recomputeNumber(e164);
    },
    async internal(e164) {
      return (await db.query('SELECT * FROM reputations WHERE e164 = $1', [e164])).rows[0] ?? null;
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      await db.end();
      const c = new pg.Client({ connectionString: DATABASE_URL });
      await c.connect();
      await c.query(`DROP SCHEMA ${schema} CASCADE`);
      await c.end();
    },
  };
}

/** N dispositivos maduros (120 dias), cada um numa rede, denunciam; denúncias envelhecem `hours`. */
export async function communityReports(env: Env, e164: string, category: string, n: number, hours = 72) {
  const devices = [];
  for (let i = 0; i < n; i++) {
    const d = await env.device({ ageDays: 120 });
    const r = await env.report(d.token, e164, category);
    if (r.status !== 201) throw new Error(JSON.stringify(r.body));
    devices.push({ ...d, ref: r.body.ref as string });
  }
  await env.age(e164, hours);
  return devices;
}
