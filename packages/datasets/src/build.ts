/** Monta um dataset publicável (shards gzip + deltas + manifest assinado) a partir de registros. */
import { gzipSync } from 'node:zlib';
import type { KeyObject } from 'node:crypto';
import { encodeShard, Flags, ShardKind, type DatasetRecord } from './binary.ts';
import { sha256Hex, signManifest, type DeltaEntry, type Manifest, type ShardEntry } from './manifest.ts';

export interface BuildInput {
  version: number;
  previousVersion?: number;
  /** Registros por shard da versão anterior — gera deltas quando informado. */
  previous?: Map<string, DatasetRecord[]>;
  current: Map<string, DatasetRecord[]>;
  createdAt: Date;
  ttlDays: number;
  keyId: string;
  privateKey: KeyObject;
  policy?: Manifest['publication_policy'];
}

export interface BuiltDataset {
  manifest: Manifest;
  manifestBytes: Buffer;
  signature: string;
  files: Map<string, Buffer>;
}

const sortRecords = (rs: DatasetRecord[]) => [...rs].sort((a, b) => (a.number < b.number ? -1 : a.number > b.number ? 1 : 0));

function gz(buf: Buffer): Buffer {
  // mtime fixo (0) e sem nome de arquivo → saída determinística
  return gzipSync(buf, { level: 9 });
}

function diff(prev: DatasetRecord[], curr: DatasetRecord[]): DatasetRecord[] {
  const p = new Map(prev.map((r) => [r.number, r]));
  const c = new Map(curr.map((r) => [r.number, r]));
  const out: DatasetRecord[] = [];
  for (const [n, r] of c) {
    const old = p.get(n);
    if (!old || JSON.stringify({ ...old, number: 0 }) !== JSON.stringify({ ...r, number: 0 })) out.push(r);
  }
  for (const [n, r] of p) {
    if (!c.has(n)) out.push({ ...r, flags: Flags.TOMBSTONE, score: 0, confidence: 0, reporters: 0 });
  }
  return sortRecords(out);
}

export function buildDataset(input: BuildInput): BuiltDataset {
  const files = new Map<string, Buffer>();
  const shards: ShardEntry[] = [];
  const deltas: DeltaEntry[] = [];
  let total = 0;
  const version = BigInt(input.version);

  for (const id of [...input.current.keys()].sort()) {
    const records = sortRecords(input.current.get(id) ?? []);
    total += records.length;
    const path = `brazil/${id}.bin.gz`;
    const bytes = gz(encodeShard({ kind: ShardKind.FULL, version, fromVersion: 0n, records }));
    files.set(path, bytes);
    shards.push({ id, path, version: input.version, sha256: sha256Hex(bytes), size: bytes.length, record_count: records.length });

    if (input.previous && input.previousVersion !== undefined) {
      const changes = diff(input.previous.get(id) ?? [], records);
      const dpath = `brazil/deltas/${id}.${input.previousVersion}-${input.version}.bin.gz`;
      const dbytes = gz(encodeShard({ kind: ShardKind.DELTA, version, fromVersion: BigInt(input.previousVersion), records: changes }));
      files.set(dpath, dbytes);
      deltas.push({
        shard: id, from_version: input.previousVersion, to_version: input.version, path: dpath,
        sha256: sha256Hex(dbytes), size: dbytes.length, record_count: changes.length,
      });
    }
  }

  const manifest: Manifest = {
    schema_version: 1,
    dataset: 'br-calls',
    version: input.version,
    created_at: input.createdAt.toISOString(),
    expires_at: new Date(input.createdAt.getTime() + input.ttlDays * 86_400_000).toISOString(),
    key_id: input.keyId,
    compression: 'gzip',
    record_count: total,
    publication_policy: input.policy ?? { min_weighted_reporters: 3, min_age_hours: 48, min_score: 60 },
    shards,
    deltas,
  };
  const { bytes, signature } = signManifest(manifest, input.privateKey);
  return { manifest, manifestBytes: bytes, signature, files };
}
