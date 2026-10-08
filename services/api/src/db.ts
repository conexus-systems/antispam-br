import { readdirSync, readFileSync } from 'node:fs';
import pg from 'pg';

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

const MIGRATIONS_DIR = new URL('../db/migrations/', import.meta.url);
const MIGRATION_LOCK = 7_340_001;

export function createPool(connectionString: string, options: pg.PoolConfig = {}): Db {
  return new pg.Pool({ connectionString, max: 10, ...options });
}

export async function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tx = await db.connect();
  try {
    await tx.query('BEGIN');
    const out = await fn(tx);
    await tx.query('COMMIT');
    return out;
  } catch (err) {
    await tx.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    tx.release();
  }
}

/** Aplica db/migrations/*.sql em ordem, cada uma numa transação, sob advisory lock. */
export async function migrate(db: Db): Promise<string[]> {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  const conn = await db.connect();
  try {
    await conn.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const done = new Set((await conn.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8');
      await conn.query('BEGIN');
      try {
        await conn.query(sql);
        await conn.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await conn.query('COMMIT');
      } catch (err) {
        await conn.query('ROLLBACK');
        throw new Error(`migração ${file} falhou: ${(err as Error).message}`);
      }
      applied.push(file);
    }
    await conn.query('SELECT ensure_report_partitions(3)');
  } finally {
    await conn.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => {});
    conn.release();
  }
  return applied;
}
