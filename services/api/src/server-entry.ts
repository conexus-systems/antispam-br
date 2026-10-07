/**
 * Bootstrap dev da Community API (M8).
 * Produção usará Postgres (ver db/schema.sql); aqui InMemory para desenvolvimento.
 */
import { createApp, InMemoryStore } from './server';
import type { ReporterStats } from './antibuse';

const PORT = Number(process.env.PORT ?? 8787);

const store = new InMemoryStore();
const reporterStats = new Map<string, ReporterStats>();

const app = createApp({ store, reporterStats, currentManifest: null });

app.listen(PORT, () => {
  console.log(`[antispam-br-api] dev server em http://localhost:${PORT}`);
  console.log('[antispam-br-api] ATENÇÃO: store em memória — dados perdem ao reiniciar.');
});
