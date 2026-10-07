/** Manifest assinado — docs/specs/DATASET_FORMAT.md §2. */
import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

export interface ShardEntry {
  id: string;
  path: string;
  version: number;
  sha256: string;
  size: number;
  record_count: number;
}

export interface DeltaEntry {
  shard: string;
  from_version: number;
  to_version: number;
  path: string;
  sha256: string;
  size: number;
  record_count: number;
}

export interface Manifest {
  schema_version: 1;
  dataset: 'br-calls';
  version: number;
  created_at: string;
  expires_at: string;
  key_id: string;
  compression: 'gzip';
  record_count: number;
  publication_policy: { min_weighted_reporters: number; min_age_hours: number; min_score: number };
  shards: ShardEntry[];
  deltas: DeltaEntry[];
}

export type VerifyFailure =
  | 'BAD_SIGNATURE'
  | 'UNKNOWN_KEY'
  | 'BAD_SCHEMA'
  | 'ROLLBACK'
  | 'EXPIRED'
  | 'UNSUPPORTED_COMPRESSION'
  | 'BAD_PATH';

export type VerifyResult = { ok: true; manifest: Manifest } | { ok: false; reason: VerifyFailure };

const PATH_RE = /^brazil\/(deltas\/)?[a-z0-9.-]+\.bin\.gz$/;
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function publicKeyFromRaw(raw32: Buffer): KeyObject {
  return createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, raw32]), format: 'der', type: 'spki' });
}

export function privateKeyFromSeed(seed32: Buffer): KeyObject {
  return createPrivateKey({ key: Buffer.concat([ED25519_PKCS8_PREFIX, seed32]), format: 'der', type: 'pkcs8' });
}

export function rawPublicKey(pub: KeyObject): Buffer {
  return pub.export({ format: 'der', type: 'spki' }).subarray(ED25519_SPKI_PREFIX.length);
}

/** Serializa o manifest e retorna bytes + assinatura base64 (destacada). */
export function signManifest(manifest: Manifest, privateKey: KeyObject): { bytes: Buffer; signature: string } {
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { bytes, signature: sign(null, bytes, privateKey).toString('base64') };
}

export function verifyManifest(
  bytes: Buffer,
  signatureB64: string,
  trustedKeys: Record<string, Buffer>,
  opts: { installedVersion?: number; now?: Date } = {},
): VerifyResult {
  let parsed: Manifest;
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as Manifest;
  } catch {
    return { ok: false, reason: 'BAD_SCHEMA' };
  }
  const raw = typeof parsed?.key_id === 'string' ? trustedKeys[parsed.key_id] : undefined;
  if (!raw) return { ok: false, reason: 'UNKNOWN_KEY' };
  let sigOk = false;
  try {
    sigOk = verify(null, bytes, publicKeyFromRaw(raw), Buffer.from(signatureB64.trim(), 'base64'));
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { ok: false, reason: 'BAD_SIGNATURE' };
  if (parsed.schema_version !== 1 || parsed.dataset !== 'br-calls' || !Number.isSafeInteger(parsed.version)) {
    return { ok: false, reason: 'BAD_SCHEMA' };
  }
  if (opts.installedVersion !== undefined && parsed.version <= opts.installedVersion) return { ok: false, reason: 'ROLLBACK' };
  const expires = Date.parse(parsed.expires_at);
  if (!Number.isFinite(expires) || (opts.now ?? new Date()).getTime() >= expires) return { ok: false, reason: 'EXPIRED' };
  if (parsed.compression !== 'gzip') return { ok: false, reason: 'UNSUPPORTED_COMPRESSION' };
  for (const p of [...parsed.shards.map((s) => s.path), ...parsed.deltas.map((d) => d.path)]) {
    if (!PATH_RE.test(p) || p.includes('..')) return { ok: false, reason: 'BAD_PATH' };
  }
  return { ok: true, manifest: parsed };
}
