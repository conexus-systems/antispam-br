/** Publicação (M3) e distribuição de datasets assinados — docs/specs/DATASET_FORMAT.md. */
import type { KeyObject } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import {
  buildDataset, decodeShard, Flags, type Category, type DatasetRecord,
} from '@antispam-br/datasets';
import { e164ToKey } from '@antispam-br/phone-normalizer';
import { DEFAULT_CONFIG } from '@antispam-br/reputation';
import { recompute, recomputeStale, timeSensitiveNumbers } from './community.ts';
import type { Config } from './config.ts';
import { withTx, type Db, type Tx } from './db.ts';
import { HttpError } from './http.ts';

export interface PublishOptions {
  privateKey: KeyObject;
  keyId: string;
  ttlDays?: number;
  now?: Date;
}

/** Agrupa números suspeitos por bloco de 10 mil (últimos 4 dígitos) — campanha = ≥3 números ativos no bloco. */
export async function refreshCampaigns(db: Db | Tx): Promise<number> {
  await db.query(`
    WITH blocks AS (
      SELECT left(e164, length(e164) - 4) || 'XXXX' AS pattern,
             mode() WITHIN GROUP (ORDER BY category) AS category,
             count(*)::int AS numbers, min(first_report_at) AS first_seen, max(last_report_at) AS last_seen
      FROM reputations
      WHERE score >= 40 AND NOT disputed AND NOT verified_org AND category IS NOT NULL
        AND last_report_at > now() - interval '14 days'
      GROUP BY 1 HAVING count(*) >= 3
    ), upserted AS (
      INSERT INTO campaigns (pattern, category, numbers, first_seen, last_seen, updated_at)
      SELECT pattern, category, numbers, first_seen, last_seen, now() FROM blocks
      ON CONFLICT (pattern) DO UPDATE SET category = EXCLUDED.category, numbers = EXCLUDED.numbers,
        first_seen = EXCLUDED.first_seen, last_seen = EXCLUDED.last_seen, updated_at = now()
      RETURNING pattern
    )
    DELETE FROM campaigns WHERE pattern NOT IN (SELECT pattern FROM upserted)`);
  const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM campaigns');
  return rows[0].n;
}

export async function listCampaigns(db: Db) {
  const { rows } = await db.query(
    `SELECT pattern, category, numbers, first_seen::date AS first_seen, last_seen::date AS last_seen
     FROM campaigns ORDER BY numbers DESC, last_seen DESC LIMIT 100`,
  );
  return { campaigns: rows };
}

function nextVersion(now: Date, previous: number | null): number {
  const d = now.toISOString().slice(0, 10).replaceAll('-', '');
  const base = Number(d) * 100;
  return previous !== null && previous >= base ? previous + 1 : base;
}

async function loadPrevious(tx: Tx, version: number): Promise<Map<string, DatasetRecord[]>> {
  const { rows } = await tx.query<{ path: string; bytes: Buffer }>(
    `SELECT path, bytes FROM dataset_files WHERE version = $1 AND path NOT LIKE 'brazil/deltas/%'`, [version],
  );
  const out = new Map<string, DatasetRecord[]>();
  for (const r of rows) {
    const id = r.path.replace(/^brazil\//, '').replace(/\.bin\.gz$/, '');
    out.set(id, decodeShard(gunzipSync(r.bytes)).records);
  }
  return out;
}

export async function publishDataset(db: Db, config: Config, opts: PublishOptions) {
  const now = opts.now ?? new Date();
  // Decaimento, janela de 48 h, fim de surto e de proteção dependem só do relógio. Recalcula antes,
  // em transações curtas (sem travar a API); dentro da publicação só sobra o que mudou no meio.
  const { rows: start } = await db.query<{ now: Date }>('SELECT now() AS now');
  await recomputeStale(db, config, start[0].now, 1_000_000);
  return withTx(db, async (tx) => {
    // Um publicador por vez; versões são monotônicas.
    await tx.query('SELECT pg_advisory_xact_lock(7340002)');
    for (const e164 of await timeSensitiveNumbers(tx, start[0].now, 1_000_000)) await recompute(tx, config, e164);
    await refreshCampaigns(tx);
    const { rows: prev } = await tx.query<{ version: string }>('SELECT max(version) AS version FROM dataset_versions');
    const previousVersion = prev[0].version === null ? null : Number(prev[0].version);
    const version = nextVersion(now, previousVersion);

    const { rows } = await tx.query<{
      e164: string; shard: string; score: number; category: Category; weighted_reporters: number;
      distinct_reporters: number; disputed: boolean; verified_org: boolean; last_report_at: Date; campaign: boolean;
    }>(`
      SELECT r.e164, n.shard, r.score, r.category, r.weighted_reporters, r.distinct_reporters,
             r.disputed, r.verified_org, r.last_report_at,
             EXISTS (SELECT 1 FROM campaigns c WHERE c.pattern = left(r.e164, length(r.e164) - 4) || 'XXXX') AS campaign
      FROM reputations r JOIN phone_numbers n ON n.e164 = r.e164
      WHERE r.publishable AND r.category IS NOT NULL
      ORDER BY r.e164`);

    const current = new Map<string, DatasetRecord[]>();
    for (const r of rows) {
      const flags = (r.campaign ? Flags.CAMPAIGN : 0) | (r.disputed ? Flags.DISPUTED : 0) | (r.verified_org ? Flags.VERIFIED_ORG : 0);
      const list = current.get(r.shard) ?? [];
      list.push({
        number: e164ToKey(r.e164),
        score: r.score,
        category: r.category,
        confidence: Math.round(100 * (1 - Math.exp(-r.weighted_reporters / DEFAULT_CONFIG.saturation))),
        flags,
        reporters: r.distinct_reporters,
        lastSeen: r.last_report_at,
      });
      current.set(r.shard, list);
    }
    const previous = previousVersion === null ? undefined : await loadPrevious(tx, previousVersion);
    // Shard que esvaziou continua existindo (vazio) para os deltas gerarem tombstones.
    for (const id of previous?.keys() ?? []) if (!current.has(id)) current.set(id, []);

    const pub = DEFAULT_CONFIG.publication;
    const built = buildDataset({
      version,
      previousVersion: previousVersion ?? undefined,
      previous,
      current,
      createdAt: now,
      ttlDays: opts.ttlDays ?? 14,
      keyId: opts.keyId,
      privateKey: opts.privateKey,
      policy: { min_weighted_reporters: pub.minWeightedReporters, min_age_hours: pub.minAgeHours, min_score: pub.minScore },
    });

    await tx.query(
      `INSERT INTO dataset_versions (version, created_at, expires_at, key_id, record_count, manifest, signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [version, built.manifest.created_at, built.manifest.expires_at, opts.keyId, built.manifest.record_count,
        built.manifestBytes, built.signature],
    );
    for (const [path, bytes] of built.files) {
      const entry = [...built.manifest.shards, ...built.manifest.deltas].find((e) => e.path === path);
      if (!entry) throw new Error(`arquivo fora do manifest: ${path}`);
      await tx.query('INSERT INTO dataset_files (version, path, sha256, bytes) VALUES ($1, $2, $3, $4)',
        [version, path, entry.sha256, bytes]);
    }
    return { version, record_count: built.manifest.record_count, shards: built.manifest.shards.length, deltas: built.manifest.deltas.length };
  });
}

async function latestVersion(db: Db): Promise<number> {
  const { rows } = await db.query<{ version: string | null }>('SELECT max(version) AS version FROM dataset_versions');
  if (rows[0].version === null) throw new HttpError(404, 'NO_DATASET_PUBLISHED');
  return Number(rows[0].version);
}

function parseVersion(raw: string): number {
  if (!/^\d{1,12}$/.test(raw)) throw new HttpError(404, 'DATASET_NOT_FOUND');
  return Number(raw);
}

export async function manifestBytes(db: Db, rawVersion: string | null, signature: boolean) {
  const version = rawVersion === null ? await latestVersion(db) : parseVersion(rawVersion);
  const { rows } = await db.query<{ manifest: Buffer; signature: string }>(
    'SELECT manifest, signature FROM dataset_versions WHERE version = $1', [version],
  );
  if (rows.length === 0) throw new HttpError(404, 'DATASET_NOT_FOUND');
  return signature
    ? { contentType: 'text/plain; charset=us-ascii', data: rows[0].signature }
    : { contentType: 'application/json; charset=utf-8', data: rows[0].manifest };
}

export async function datasetIndex(db: Db, rawVersion: string) {
  const version = parseVersion(rawVersion);
  const { rows } = await db.query<{ path: string; sha256: string; size: number }>(
    'SELECT path, sha256, octet_length(bytes) AS size FROM dataset_files WHERE version = $1 ORDER BY path', [version],
  );
  if (rows.length === 0) throw new HttpError(404, 'DATASET_NOT_FOUND');
  const base = `/v1/datasets/${version}`;
  return {
    version,
    manifest: `${base}/manifest.json`,
    signature: `${base}/manifest.json.sig`,
    files: rows.map((r) => ({ ...r, url: `${base}/${r.path}` })),
  };
}

export async function datasetFile(db: Db, rawVersion: string, path: string) {
  const version = parseVersion(rawVersion);
  const { rows } = await db.query<{ bytes: Buffer }>(
    'SELECT bytes FROM dataset_files WHERE version = $1 AND path = $2', [version, path],
  );
  if (rows.length === 0) throw new HttpError(404, 'FILE_NOT_FOUND');
  return { contentType: 'application/gzip', data: rows[0].bytes };
}
