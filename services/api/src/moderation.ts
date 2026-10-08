/** Moderação humana: contestações e quarentena de dispositivos. Toda decisão vai para moderation_decisions. */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { DEFAULT_CONFIG } from '@antispam-br/reputation';
import type { Config } from './config.ts';
import { recompute } from './community.ts';
import { withTx, type Db, type Tx } from './db.ts';
import { HttpError } from './http.ts';

/** Devolve o nome do moderador dono do token (cada moderador tem o seu). */
export function requireModerator(config: Config, req: IncomingMessage): string {
  if (config.moderators.size === 0) throw new HttpError(404, 'NOT_FOUND');
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  const digest = (s: string) => createHash('sha256').update(s).digest();
  if (m) {
    const given = digest(m[1]);
    for (const [token, name] of config.moderators) {
      if (timingSafeEqual(given, digest(token))) return name;
    }
  }
  throw new HttpError(401, 'MODERATOR_REQUIRED');
}

function reason(body: Record<string, unknown>): string {
  const r = body.reason;
  if (typeof r !== 'string' || r.trim().length < 3 || r.length > 500) {
    throw new HttpError(400, 'INVALID_FIELD', 'reason entre 3 e 500 caracteres', { field: 'reason' });
  }
  return r.trim();
}

async function log(tx: Tx, type: string, id: string, decision: string, why: string, moderator: string) {
  await tx.query(
    `INSERT INTO moderation_decisions (subject_type, subject_id, decision, reason, moderator) VALUES ($1, $2, $3, $4, $5)`,
    [type, id, decision, why, moderator],
  );
}

/** Fila por peso do contestante: contestações de dispositivos novos não afogam as qualificadas. */
export async function listContests(db: Db, status: string) {
  if (!['PENDING', 'ACCEPTED', 'REJECTED'].includes(status)) throw new HttpError(400, 'INVALID_FIELD', 'status inválido', { field: 'status' });
  const { rows } = await db.query(
    `SELECT c.id, c.e164 AS number, c.status, c.weight, c.comment, c.created_at, c.decided_at,
            r.score, r.label, r.category, r.weighted_reporters, r.contest_weight, r.blocked_by,
            (SELECT coalesce(json_agg(x.comment ORDER BY x.created_at DESC), '[]') FROM (
               SELECT comment, created_at FROM reports
               WHERE e164 = c.e164 AND comment IS NOT NULL AND created_at > now() - interval '90 days'
               ORDER BY created_at DESC LIMIT 5) x) AS recent_report_comments
     FROM contests c LEFT JOIN reputations r ON r.e164 = c.e164
     WHERE c.status = $1 ORDER BY c.weight DESC, c.created_at LIMIT 200`,
    [status],
  );
  return { contests: rows };
}

/** Trava dispositivos em ordem de id (evita deadlock entre decisões concorrentes) e aplica o ajuste. */
async function adjust(tx: Tx, ids: number[], column: 'agreements' | 'disagreements'): Promise<void> {
  if (ids.length === 0) return;
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  await tx.query('SELECT id FROM devices WHERE id = ANY($1) ORDER BY id FOR UPDATE', [sorted]);
  await tx.query(`UPDATE devices SET ${column} = ${column} + 1 WHERE id = ANY($1)`, [sorted]);
}

/**
 * ACCEPT: número protegido; quem denunciou abuso perde precisão; contestantes maduros ganham.
 * REJECT: contestantes perdem precisão; denunciantes NÃO ganham (senão um grupo forja contestação
 * contra o próprio spam real para inflar o peso).
 * Só contam opiniões emitidas desde a decisão anterior do mesmo número (sem dupla contagem).
 */
export async function decideContest(db: Db, config: Config, moderator: string, contestId: number, body: Record<string, unknown>) {
  const decision = body.decision;
  if (decision !== 'ACCEPT' && decision !== 'REJECT') throw new HttpError(400, 'INVALID_FIELD', 'decision = ACCEPT | REJECT', { field: 'decision' });
  const why = reason(body);
  return withTx(db, async (tx) => {
    const { rows } = await tx.query<{ e164: string; status: string }>(
      'SELECT e164, status FROM contests WHERE id = $1 FOR UPDATE', [contestId],
    );
    if (rows.length === 0) throw new HttpError(404, 'CONTEST_NOT_FOUND');
    if (rows[0].status !== 'PENDING') throw new HttpError(409, 'ALREADY_DECIDED');
    const { e164 } = rows[0];
    const status = decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

    const { rows: opinions } = await tx.query<{ device_id: string; abuse: boolean; age_days: number }>(
      `SELECT DISTINCT ON (r.device_id) r.device_id, r.category <> 'LEGITIMATE' AS abuse,
              extract(epoch FROM now() - d.created_at) / 86400 AS age_days
       FROM reports r JOIN devices d ON d.id = r.device_id
       WHERE r.e164 = $1 AND r.created_at > now() - interval '400 days'
         AND r.created_at > coalesce((SELECT max(decided_at) FROM contests WHERE e164 = $1 AND decided_at IS NOT NULL), '-infinity')
       ORDER BY r.device_id, r.created_at DESC`,
      [e164],
    );
    const reporters = opinions.filter((o) => o.abuse).map((o) => Number(o.device_id));
    const contesters = opinions.filter((o) => !o.abuse);
    if (decision === 'ACCEPT') {
      await adjust(tx, reporters, 'disagreements');
      await adjust(tx, contesters.filter((o) => Number(o.age_days) >= DEFAULT_CONFIG.youngReporterDays).map((o) => Number(o.device_id)), 'agreements');
    } else {
      await adjust(tx, contesters.map((o) => Number(o.device_id)), 'disagreements');
    }

    // Uma decisão fecha todas as contestações pendentes do número (mesmo fato).
    const { rows: closed } = await tx.query<{ id: string }>(
      `UPDATE contests SET status = $2, decided_at = now() WHERE e164 = $1 AND status = 'PENDING' RETURNING id`,
      [e164, status],
    );
    for (const c of closed) await log(tx, 'CONTEST', c.id, status, why, moderator);
    const reputation = await recompute(tx, config, e164);
    return { number: e164, status, closed: closed.length, reputation };
  });
}

/** Quarentena zera o peso do dispositivo em todas as denúncias e recalcula os números afetados. */
export async function quarantineDevice(db: Db, config: Config, moderator: string, deviceId: number, body: Record<string, unknown>) {
  const why = reason(body);
  return withTx(db, async (tx) => {
    const r = await tx.query(
      'UPDATE devices SET quarantined_at = now(), quarantine_reason = $2 WHERE id = $1 AND quarantined_at IS NULL',
      [deviceId, why],
    );
    if (r.rowCount === 0) throw new HttpError(404, 'DEVICE_NOT_FOUND_OR_QUARANTINED');
    await log(tx, 'DEVICE', String(deviceId), 'QUARANTINE', why, moderator);
    const { rows } = await tx.query<{ e164: string }>(
      `SELECT DISTINCT e164 FROM reports WHERE device_id = $1 AND created_at > now() - interval '400 days' ORDER BY e164`,
      [deviceId],
    );
    for (const { e164 } of rows) await recompute(tx, config, e164);
    return { device: deviceId, recomputed: rows.length };
  });
}
