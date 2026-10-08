/** Denúncias, votos, contestações e recálculo de reputação (ADR 0006). */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { normalize } from '@antispam-br/phone-normalizer';
import {
  computeReputation, DEFAULT_CONFIG, isCategory, reporterWeight, type Category, type ReportInput,
} from '@antispam-br/reputation';
import type { Config } from './config.ts';
import { withTx, type Db, type Tx } from './db.ts';
import type { Device } from './devices.ts';
import { HttpError } from './http.ts';
import { hit } from './limits.ts';

/** Contestação aceita protege o número por este período mesmo com denúncias novas. */
const CONTEST_PROTECTION_DAYS = 90;
const HISTORY_DAYS = 400;
/** Dispositivo acima do p99 diário da frota (e deste mínimo) perde o peso no dia (ADR 0006 §7). */
const OUTLIER_MIN_DAILY = 10;

export interface ParsedNumber {
  e164: string;
  sha256: string;
  kind: string;
  ddd: string | null;
  shard: string;
}

export function parseNumber(raw: string): ParsedNumber {
  if (raw.length > 32) throw new HttpError(422, 'INVALID_NUMBER');
  const n = normalize(raw);
  if (n.kind === 'EMERGENCY') throw new HttpError(422, 'EMERGENCY_NUMBER', 'números de emergência e utilidade pública não recebem denúncias');
  if (!n.e164 || !n.shard) throw new HttpError(422, 'INVALID_NUMBER');
  return { e164: n.e164, sha256: sha256Hex(n.e164), kind: n.kind, ddd: n.ddd, shard: n.shard };
}

export const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex');

/** Referência opaca de denúncia: só o autor recebe; ids sequenciais não são enumeráveis. */
export function reportRef(id: number, secret: Buffer): string {
  const mac = createHmac('sha256', secret).update(`report:${id}`).digest('base64url').slice(0, 22);
  return `${id.toString(36)}.${mac}`;
}

function parseReportRef(ref: string, secret: Buffer): number | null {
  const m = /^([0-9a-z]{1,12})\.([A-Za-z0-9_-]{22})$/.exec(ref);
  if (!m) return null;
  const id = parseInt(m[1], 36);
  const expected = Buffer.from(reportRef(id, secret).split('.')[1]);
  const given = Buffer.from(m[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}

function str(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  if (typeof v !== 'string') throw new HttpError(400, 'INVALID_FIELD', `${key} obrigatório`, { field: key });
  return v;
}

function optionalComment(body: Record<string, unknown>): string | null {
  const v = body.comment;
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || v.length > 280) throw new HttpError(400, 'INVALID_FIELD', 'comment até 280 caracteres', { field: 'comment' });
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() || null;
}

async function rateLimit(db: Db, config: Config, device: Device, network: string): Promise<void> {
  await hit(db, `act:dev:${device.id}:m`, 60, config.limits.deviceActionsPerMinute);
  await hit(db, `act:dev:${device.id}:d`, 86_400, config.limits.deviceActionsPerDay);
  await hit(db, `act:net:${network}:d`, 86_400, config.limits.networkActionsPerDay);
}

async function contestLimit(db: Db, config: Config, device: Device, network: string): Promise<void> {
  await hit(db, `contest:dev:${device.id}:d`, 86_400, config.limits.deviceContestsPerDay);
  await hit(db, `contest:net:${network}:d`, 86_400, config.limits.networkContestsPerDay);
}

/** Nonce de uso único + timestamp do cliente dentro da janela: denúncia reenviada não conta duas vezes. */
async function consumeNonce(tx: Tx, config: Config, device: Device, body: Record<string, unknown>, now: number): Promise<void> {
  const nonce = str(body, 'nonce');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(nonce)) throw new HttpError(400, 'INVALID_FIELD', 'nonce inválido', { field: 'nonce' });
  const ts = typeof body.timestamp === 'number' ? body.timestamp : Date.parse(String(body.timestamp ?? ''));
  if (!Number.isFinite(ts) || Math.abs(now - ts) > config.clockSkewMs) throw new HttpError(400, 'STALE_REQUEST');
  const r = await tx.query(
    'INSERT INTO report_nonces (device_id, nonce) VALUES ($1, $2) ON CONFLICT DO NOTHING', [device.id, nonce],
  );
  if (r.rowCount === 0) throw new HttpError(409, 'REPLAY');
}

async function ensureNumber(tx: Tx, n: ParsedNumber): Promise<void> {
  await tx.query(
    `INSERT INTO phone_numbers (e164, sha256, kind, ddd, shard) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (e164) DO NOTHING`,
    [n.e164, n.sha256, n.kind, n.ddd, n.shard],
  );
}

async function insertReport(
  tx: Tx, e164: string, device: Device, category: Category, source: string,
  extra: { comment?: string | null; parentId?: number } = {},
): Promise<number> {
  const { rows } = await tx.query<{ id: string }>(
    `INSERT INTO reports (e164, device_id, category, source, comment, parent_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [e164, device.id, category, source, extra.comment ?? null, extra.parentId ?? null],
  );
  return Number(rows[0].id);
}

/** Dispositivo em quarentena não abre fila de moderação (aceita-se o pedido em silêncio). */
async function openContest(tx: Tx, e164: string, device: Device, comment: string | null): Promise<void> {
  if (device.quarantined) return;
  const weight = reporterWeight({
    ageDays: device.ageDays, agreements: device.agreements, disagreements: device.disagreements, quarantined: false,
  });
  await tx.query(
    `INSERT INTO contests (e164, device_id, comment, weight) VALUES ($1, $2, $3, $4)
     ON CONFLICT (e164, device_id) WHERE status = 'PENDING' DO NOTHING`,
    [e164, device.id, comment, weight],
  );
}

export async function createReport(
  db: Db, config: Config, device: Device, network: string, body: Record<string, unknown>, now = Date.now(),
) {
  const number = parseNumber(str(body, 'number'));
  const category = body.category;
  if (!isCategory(category)) throw new HttpError(400, 'INVALID_FIELD', 'categoria desconhecida', { field: 'category' });
  if (category === 'LEGITIMATE') throw new HttpError(400, 'USE_LEGITIMATE_ENDPOINT');
  const comment = optionalComment(body);
  await rateLimit(db, config, device, network);

  return withTx(db, async (tx) => {
    await consumeNonce(tx, config, device, body, now);
    await ensureNumber(tx, number);
    const id = await insertReport(tx, number.e164, device, category, 'USER_REPORT', { comment });
    const reputation = await recompute(tx, config, number.e164);
    return { ref: reportRef(id, config.serverSecret), number: number.e164, reputation };
  });
}

/** Voto em denúncia compartilhada pelo autor (ex.: alerta enviado à família). Não revela o número. */
export async function vote(
  db: Db, config: Config, device: Device, network: string, ref: string, body: Record<string, unknown>, now = Date.now(),
) {
  const v = body.vote;
  if (v !== 'confirm' && v !== 'dispute') throw new HttpError(400, 'INVALID_FIELD', 'vote = confirm | dispute', { field: 'vote' });
  const reportId = parseReportRef(ref, config.serverSecret);
  if (reportId === null) throw new HttpError(404, 'REPORT_NOT_FOUND');
  await rateLimit(db, config, device, network);
  if (v === 'dispute') await contestLimit(db, config, device, network);

  return withTx(db, async (tx) => {
    const { rows } = await tx.query<{ e164: string; category: Category; device_id: string }>(
      `SELECT e164, category, device_id FROM reports
       WHERE id = $1 AND created_at > now() - make_interval(days => $2)`,
      [reportId, HISTORY_DAYS],
    );
    if (rows.length === 0) throw new HttpError(404, 'REPORT_NOT_FOUND');
    const target = rows[0];
    if (Number(target.device_id) === device.id) throw new HttpError(409, 'OWN_REPORT');
    await consumeNonce(tx, config, device, body, now);
    if (v === 'confirm') {
      if (target.category === 'LEGITIMATE') throw new HttpError(409, 'CANNOT_CONFIRM_CONTEST');
      await insertReport(tx, target.e164, device, target.category, 'USER_VOTE', { parentId: reportId });
    } else {
      await insertReport(tx, target.e164, device, 'LEGITIMATE', 'USER_VOTE', { parentId: reportId });
      await openContest(tx, target.e164, device, null);
    }
    await recompute(tx, config, target.e164);
    return { vote: 'recorded' };
  });
}

export async function markLegitimate(
  db: Db, config: Config, device: Device, network: string, rawNumber: string, body: Record<string, unknown>, now = Date.now(),
) {
  const number = parseNumber(rawNumber);
  const comment = optionalComment(body);
  await rateLimit(db, config, device, network);
  await contestLimit(db, config, device, network);
  return withTx(db, async (tx) => {
    await consumeNonce(tx, config, device, body, now);
    await ensureNumber(tx, number);
    await insertReport(tx, number.e164, device, 'LEGITIMATE', 'USER_REPORT', { comment });
    await openContest(tx, number.e164, device, comment);
    return { number: number.e164, contest: 'RECEIVED', reputation: await recompute(tx, config, number.e164) };
  });
}

interface ReputationRow {
  e164: string;
  score: number;
  label: string;
  category: string | null;
  weighted_reporters: number;
  distinct_reporters: number;
  disputed: boolean;
  verified_org: boolean;
  publishable: boolean;
  factors: unknown;
  last_report_at: Date | null;
}

/**
 * Visão pública. Só número publicado mostra score: denúncias em análise, recentes, em surto ou
 * insuficientes não difamam ninguém nem revelam que o número foi denunciado.
 */
export function publicReputation(row: ReputationRow | null, e164: string) {
  if (!row?.publishable) return { number: e164, published: false, status: 'NOT_LISTED', score: null, label: null };
  return {
    number: row.e164,
    published: true,
    status: 'LISTED',
    score: row.score,
    label: row.label,
    category: row.category,
    disputed: row.disputed,
    verified_org: row.verified_org,
    evidence: { weighted_reporters: Math.round(row.weighted_reporters * 10) / 10, distinct_reporters: row.distinct_reporters },
    factors: row.factors,
    last_report_at: row.last_report_at?.toISOString().slice(0, 10) ?? null,
  };
}

export async function recompute(tx: Tx, config: Config, e164: string) {
  // Serializa recálculos do mesmo número: em READ COMMITTED, após o lock vemos as denúncias já commitadas.
  await tx.query('SELECT 1 FROM phone_numbers WHERE e164 = $1 FOR UPDATE', [e164]);
  const { rows: ctxRows } = await tx.query<{
    now: string; never_block: boolean; verified_org: boolean; accepted_at: Date | null;
  }>(
    `SELECT
       extract(epoch FROM clock_timestamp()) * 1000 AS now,
       EXISTS (SELECT 1 FROM prefixes p WHERE p.never_block AND $1 LIKE p.prefix || '%') AS never_block,
       EXISTS (SELECT 1 FROM phone_numbers n JOIN organizations o ON o.id = n.organization_id
               WHERE n.e164 = $1 AND o.verified_at IS NOT NULL) AS verified_org,
       (SELECT max(decided_at) FROM contests c WHERE c.e164 = $1 AND c.status = 'ACCEPTED') AS accepted_at`,
    [e164],
  );
  const ctx = ctxRows[0];
  // Só contestante maduro e fora de quarentena suspende; peso somado por rede tem teto, e ao menos um
  // contestante precisa ter contestAnchorDays (contas pré-envelhecidas por uma semana não bastam).
  const { rows: pending } = await tx.query<{ weight: number; network_hash: string; anchor: boolean }>(
    `SELECT c.weight, d.network_hash, d.created_at <= now() - make_interval(days => $3) AS anchor
     FROM contests c JOIN devices d ON d.id = c.device_id
     WHERE c.e164 = $1 AND c.status = 'PENDING' AND d.quarantined_at IS NULL
       AND d.created_at <= now() - make_interval(days => $2)`,
    [e164, DEFAULT_CONFIG.youngReporterDays, DEFAULT_CONFIG.contestAnchorDays],
  );
  const perNetwork = new Map<string, number>();
  for (const p of pending) perNetwork.set(p.network_hash, (perNetwork.get(p.network_hash) ?? 0) + p.weight);
  const pendingWeight = pending.some((p) => p.anchor)
    ? [...perNetwork.values()].reduce((sum, w) => sum + Math.min(DEFAULT_CONFIG.networkCap, w), 0)
    : 0;
  // Relógio do banco: é o mesmo que gravou created_at.
  const now = Number(ctx.now);
  const acceptedAt = ctx.accepted_at?.getTime() ?? null;

  // Opinião mais recente de cada dispositivo; denúncias anteriores a uma contestação aceita não contam.
  const { rows } = await tx.query<{
    device_id: string; category: Category; at: Date; age_days: number; network_hash: string;
    agreements: number; disagreements: number; quarantined: boolean; outlier: boolean;
  }>(
    `WITH fleet AS (
       SELECT greatest($4::float8, coalesce((SELECT value FROM fleet_stats WHERE key = 'device_daily_actions_p99'), 0)) AS p99
     )
     SELECT DISTINCT ON (r.device_id) r.device_id, r.category, r.created_at AS at, d.network_hash,
            extract(epoch FROM now() - d.created_at) / 86400 AS age_days,
            d.agreements, d.disagreements, d.quarantined_at IS NOT NULL AS quarantined,
            coalesce((SELECT rc.count FROM rate_counters rc
                      WHERE rc.key = 'act:dev:' || r.device_id || ':d'
                        AND rc.window_start = to_timestamp(floor(extract(epoch FROM now()) / 86400) * 86400)), 0)
              > (SELECT p99 FROM fleet) AS outlier
     FROM reports r JOIN devices d ON d.id = r.device_id
     WHERE r.e164 = $1
       AND r.created_at > now() - make_interval(days => $2)
       AND r.created_at > coalesce($3::timestamptz, '-infinity')
     ORDER BY r.device_id, r.created_at DESC`,
    [e164, HISTORY_DAYS, ctx.accepted_at, OUTLIER_MIN_DAILY],
  );
  const inputs: ReportInput[] = rows.map((r) => ({
    reporter: r.device_id,
    category: r.category,
    at: r.at.getTime(),
    reporterAgeDays: Number(r.age_days),
    network: r.network_hash,
    weight: reporterWeight({
      ageDays: Number(r.age_days), agreements: r.agreements, disagreements: r.disagreements,
      quarantined: r.quarantined, outlierToday: r.outlier,
    }),
  }));
  const rep = computeReputation(inputs, now, {
    neverBlock: ctx.never_block,
    verifiedOrg: ctx.verified_org,
    pendingContest: pendingWeight >= config.contestSuspendWeight,
    contestAccepted: acceptedAt !== null && now - acceptedAt < CONTEST_PROTECTION_DAYS * 86_400_000,
  });

  const { rows: saved } = await tx.query<ReputationRow>(
    `INSERT INTO reputations (e164, score, label, category, weighted_reporters, contest_weight, distinct_reporters,
       insufficient, burst_quarantine, disputed, verified_org, publishable, blocked_by, factors,
       first_report_at, last_report_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now())
     ON CONFLICT (e164) DO UPDATE SET
       score = EXCLUDED.score, label = EXCLUDED.label, category = EXCLUDED.category,
       weighted_reporters = EXCLUDED.weighted_reporters, contest_weight = EXCLUDED.contest_weight,
       distinct_reporters = EXCLUDED.distinct_reporters, insufficient = EXCLUDED.insufficient,
       burst_quarantine = EXCLUDED.burst_quarantine, disputed = EXCLUDED.disputed,
       verified_org = EXCLUDED.verified_org, publishable = EXCLUDED.publishable,
       blocked_by = EXCLUDED.blocked_by, factors = EXCLUDED.factors,
       first_report_at = EXCLUDED.first_report_at, last_report_at = EXCLUDED.last_report_at, updated_at = now()
     RETURNING *`,
    [
      e164, rep.score, rep.label, rep.category, rep.weightedReporters, rep.contestWeight, rep.distinctReporters,
      rep.insufficientEvidence, rep.burstQuarantine, rep.disputed, rep.verifiedOrg,
      rep.publishable, rep.blockedBy, JSON.stringify(rep.factors),
      rep.firstReportAt === null ? null : new Date(rep.firstReportAt),
      rep.lastReportAt === null ? null : new Date(rep.lastReportAt),
    ],
  );
  return publicReputation(saved[0], e164);
}

/**
 * Números cujo estado muda só com o tempo (decaimento, 48 h, fim do surto, proteção de 90 dias):
 * publicados ou com score de publicação. Recalculados antes de publicar e periodicamente.
 */
export async function timeSensitiveNumbers(q: Db | Tx, updatedBefore: Date, limit: number): Promise<string[]> {
  const { rows } = await q.query<{ e164: string }>(
    `SELECT e164 FROM reputations
     WHERE (publishable OR score >= $1 OR 'CONTEST_ACCEPTED' = ANY (blocked_by)) AND updated_at < $2
     ORDER BY updated_at LIMIT $3`,
    [DEFAULT_CONFIG.publication.minScore, updatedBefore, limit],
  );
  return rows.map((r) => r.e164);
}

/** Uma transação curta por número: nunca segura locks de vários números ao mesmo tempo. */
export async function recomputeStale(db: Db, config: Config, updatedBefore?: Date, limit = 5000): Promise<number> {
  const before = updatedBefore ?? new Date(Date.now() - 6 * 3_600_000);
  const numbers = await timeSensitiveNumbers(db, before, limit);
  for (const e164 of numbers) await withTx(db, (tx) => recompute(tx, config, e164));
  return numbers.length;
}

export async function lookup(db: Db, rawNumber: string) {
  const n = normalize(rawNumber.slice(0, 32));
  if (n.kind === 'EMERGENCY') {
    return { number: rawNumber, published: false, status: 'NEVER_BLOCK', score: null, label: null };
  }
  if (!n.e164) throw new HttpError(422, 'INVALID_NUMBER');
  const { rows } = await db.query<ReputationRow>('SELECT * FROM reputations WHERE e164 = $1', [n.e164]);
  return publicReputation(rows[0] ?? null, n.e164);
}

/** k-anonimato: cliente envia 5 hex do SHA-256 e filtra localmente (~1/1M do espaço por consulta). */
export async function hashPrefix(db: Db, prefix: string) {
  if (!/^[0-9a-f]{5}$/.test(prefix)) throw new HttpError(400, 'INVALID_PREFIX', 'prefixo = 5 caracteres hex minúsculos');
  const { rows } = await db.query<{ sha256: string; score: number; label: string; category: string | null; disputed: boolean; verified_org: boolean }>(
    `SELECT n.sha256, r.score, r.label, r.category, r.disputed, r.verified_org
     FROM phone_numbers n JOIN reputations r ON r.e164 = n.e164
     WHERE n.sha256 LIKE $1 || '%' AND r.publishable
     ORDER BY n.sha256 LIMIT 1000`,
    [prefix],
  );
  return { prefix, entries: rows };
}
