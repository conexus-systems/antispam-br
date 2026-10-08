import { loadConfig } from './config.ts';
import { recomputeStale } from './community.ts';
import { createPool, migrate } from './db.ts';
import { purgeExpired, refreshFleetStats } from './limits.ts';
import { buildServer } from './server.ts';

const config = loadConfig();
const db = createPool(config.databaseUrl);
const applied = await migrate(db);
if (applied.length) console.error(`[api] migrações aplicadas: ${applied.join(', ')}`);

const server = buildServer(config, db);
server.listen(config.port, () => console.error(`[api] ouvindo na porta ${config.port}`));

/** Retenção de denúncias e comentários: 14 meses (histórico de reputação usa 400 dias). */
const KEEP_MONTHS = 14;

async function housekeeping(): Promise<void> {
  await purgeExpired(db);
  await refreshFleetStats(db);
  await db.query('SELECT ensure_report_partitions(3)');
  await db.query('SELECT drop_old_report_partitions($1)', [KEEP_MONTHS]);
  const n = await recomputeStale(db, config);
  if (n) console.error(`[api] reputações recalculadas por tempo: ${n}`);
}

const timer = setInterval(() => housekeeping().catch((e) => console.error('[api] manutenção falhou', e)), 3_600_000);
timer.unref();

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => db.end().then(() => process.exit(0)));
  });
}
