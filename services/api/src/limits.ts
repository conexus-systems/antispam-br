import type { Db, Tx } from './db.ts';
import { HttpError } from './http.ts';

/** Janela fixa em Postgres (tabela UNLOGGED). Conta a tentativa mesmo se o pedido falhar depois. */
export async function hit(db: Db | Tx, key: string, windowSeconds: number, max: number): Promise<void> {
  const { rows } = await db.query<{ count: number; reset: number }>(
    `INSERT INTO rate_counters (key, window_start, count)
     VALUES ($1, to_timestamp(floor(extract(epoch FROM now()) / $2) * $2), 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_counters.count + 1
     RETURNING count, ceil(extract(epoch FROM window_start) + $2 - extract(epoch FROM now()))::int AS reset`,
    [key, windowSeconds],
  );
  if (rows[0].count > max) {
    throw new HttpError(429, 'RATE_LIMITED', undefined, { retry_after_seconds: Math.max(1, rows[0].reset) });
  }
}

/** Valor atual do contador sem incrementar. */
export async function peek(db: Db | Tx, key: string, windowSeconds: number): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    `SELECT count FROM rate_counters WHERE key = $1 AND window_start = to_timestamp(floor(extract(epoch FROM now()) / $2) * $2)`,
    [key, windowSeconds],
  );
  return rows[0]?.count ?? 0;
}

/** p99 de ações diárias por dispositivo (contador act:dev:<id>:d), base do outlier do ADR 0006 §7. */
export async function refreshFleetStats(db: Db): Promise<void> {
  await db.query(
    `INSERT INTO fleet_stats (key, value, updated_at)
     SELECT 'device_daily_actions_p99', coalesce(percentile_cont(0.99) WITHIN GROUP (ORDER BY count), 0), now()
     FROM rate_counters
     WHERE key LIKE 'act:dev:%:d' AND window_start = to_timestamp(floor(extract(epoch FROM now()) / 86400) * 86400)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
  );
}

export async function purgeExpired(db: Db): Promise<void> {
  await db.query(`DELETE FROM rate_counters WHERE window_start < now() - interval '2 days'`);
  // Comentários servem à moderação por 90 dias; depois disso não ficam guardados.
  // Janela estreita: a manutenção roda de hora em hora, e partições antigas já foram limpas antes.
  await db.query(
    `UPDATE reports SET comment = NULL
     WHERE comment IS NOT NULL AND created_at >= now() - interval '97 days' AND created_at < now() - interval '90 days'`,
  );
  await db.query(`DELETE FROM report_nonces WHERE created_at < now() - interval '1 day'`);
  await db.query(`DELETE FROM pow_challenges_used WHERE used_at < now() - interval '1 day'`);
}
