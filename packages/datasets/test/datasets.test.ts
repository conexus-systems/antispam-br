import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyDelta, decodeShard, encodeShard, Flags, sha256Hex, ShardKind, verifyManifest, DatasetFormatError,
} from '../src/index.ts';

const dir = fileURLToPath(new URL('../../../data/test-vectors/datasets/', import.meta.url));
const vectors = JSON.parse(readFileSync(join(dir, 'vectors.json'), 'utf8'));
const keys = Object.fromEntries(Object.entries(vectors.trusted_keys).map(([k, v]) => [k, Buffer.from(v as string, 'base64')]));
const now = new Date(vectors.now);

const load = (base: string) => ({
  bytes: readFileSync(join(dir, `${base}${base.endsWith('/') ? '' : '.'}manifest.json`)),
  sig: readFileSync(join(dir, `${base}${base.endsWith('/') ? '' : '.'}manifest.json.sig`), 'utf8'),
});

for (const v of vectors.valid) {
  test(`manifest ${v.dir} installed=${v.installed_version} → ${v.expect}`, () => {
    const { bytes, sig } = load(`${v.dir}/`);
    const r = verifyManifest(bytes, sig, keys, { now, installedVersion: v.installed_version ?? undefined });
    assert.equal(r.ok ? 'OK' : r.reason, v.expect);
  });
}

for (const v of vectors.invalid) {
  test(`manifest inválido ${v.file} → ${v.expect}`, () => {
    const { bytes, sig } = load(v.file);
    const r = verifyManifest(bytes, sig, keys, { now });
    assert.equal(r.ok ? 'OK' : r.reason, v.expect);
  });
}

test('shards conferem sha256/size/record_count e delta v1→v2 reproduz v2', () => {
  const m1 = JSON.parse(readFileSync(join(dir, 'v1/manifest.json'), 'utf8'));
  const m2 = JSON.parse(readFileSync(join(dir, 'v2/manifest.json'), 'utf8'));
  for (const s of m2.shards) {
    const gz = readFileSync(join(dir, 'v2', s.path));
    assert.equal(sha256Hex(gz), s.sha256);
    assert.equal(gz.length, s.size);
    assert.equal(decodeShard(gunzipSync(gz)).records.length, s.record_count);
  }
  for (const d of m2.deltas) {
    const base = decodeShard(gunzipSync(readFileSync(join(dir, 'v1', m1.shards.find((s: { id: string }) => s.id === d.shard).path))));
    const delta = decodeShard(gunzipSync(readFileSync(join(dir, 'v2', d.path))));
    const full = decodeShard(gunzipSync(readFileSync(join(dir, 'v2', m2.shards.find((s: { id: string }) => s.id === d.shard).path))));
    const merged = applyDelta(base, delta);
    assert.deepEqual(merged.records.map((r) => r.number), full.records.map((r) => r.number));
    assert.deepEqual(merged.records.map((r) => r.score), full.records.map((r) => r.score));
  }
});

test('lookups esperados após v2', () => {
  const m2 = JSON.parse(readFileSync(join(dir, 'v2/manifest.json'), 'utf8'));
  const all = m2.shards.flatMap((s: { path: string }) => decodeShard(gunzipSync(readFileSync(join(dir, 'v2', s.path)))).records);
  for (const l of vectors.lookups_after_v2) {
    const r = all.find((x: { number: bigint }) => x.number === BigInt(l.number));
    assert.equal(Boolean(r), l.found, l.number);
    if (r) {
      assert.equal(r.score, l.score);
      assert.equal(r.category, l.category);
      assert.equal(r.flags, l.flags);
    }
  }
});

test('encode rejeita ordem errada e TOMBSTONE em FULL; decode rejeita lixo', () => {
  const r = (n: bigint, flags = 0) => ({ number: n, score: 50, category: 'OTHER' as const, confidence: 50, flags, reporters: 1, lastSeen: new Date() });
  assert.throws(() => encodeShard({ kind: ShardKind.FULL, version: 1n, fromVersion: 0n, records: [r(2n), r(1n)] }), DatasetFormatError);
  assert.throws(() => encodeShard({ kind: ShardKind.FULL, version: 1n, fromVersion: 0n, records: [r(1n, Flags.TOMBSTONE)] }), DatasetFormatError);
  assert.throws(() => decodeShard(Buffer.from('nope')), DatasetFormatError);
  const ok = encodeShard({ kind: ShardKind.FULL, version: 1n, fromVersion: 0n, records: [r(1n)] });
  assert.throws(() => decodeShard(ok.subarray(0, ok.length - 1)), DatasetFormatError);
});
