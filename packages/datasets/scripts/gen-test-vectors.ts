/**
 * Gera data/test-vectors/datasets/ — determinístico (chave derivada de uma frase pública).
 * Uso: node packages/datasets/scripts/gen-test-vectors.ts
 */
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset, Flags, privateKeyFromSeed, publicKeyFromRaw, rawPublicKey, signManifest, type DatasetRecord, type Manifest } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../../data/test-vectors/datasets');

const seed = createHash('sha256').update('antispam-br TEST KEY v1 — never trust in release builds').digest();
const privateKey = privateKeyFromSeed(seed);
const { createPublicKey } = await import('node:crypto');
const pubRaw = rawPublicKey(createPublicKey(privateKey));
publicKeyFromRaw(pubRaw);

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const rec = (number: bigint, score: number, category: DatasetRecord['category'], flags = 0, reporters = 12): DatasetRecord => ({
  number, score, category, confidence: Math.min(100, score + 5), flags, reporters, lastSeen: day('2026-10-01'),
});

const v1 = new Map<string, DatasetRecord[]>([
  ['55-11', [
    rec(5511900000001n, 92, 'BANK_SCAM', Flags.CAMPAIGN, 340),
    rec(5511900000002n, 71, 'TELEMARKETING'),
    rec(5511900000003n, 64, 'ROBOCALL'),
    rec(551133330000n, 66, 'COLLECTION', Flags.VERIFIED_ORG, 40),
  ]],
  ['55-21', [
    rec(5521911112222n, 85, 'PIX_SCAM', 0, 120),
    rec(5521933334444n, 62, 'SILENT_CALL', Flags.DISPUTED, 7),
  ]],
  ['55-ng', [
    rec(553031234567n, 70, 'TELEMARKETING', 0, 900),
    rec(558001234567n, 61, 'SURVEY', 0, 15),
  ]],
]);

const v2 = new Map<string, DatasetRecord[]>([
  ['55-11', [
    rec(5511900000001n, 95, 'BANK_SCAM', Flags.CAMPAIGN, 410),
    rec(5511900000003n, 64, 'ROBOCALL'),
    rec(5511900000004n, 88, 'FAKE_SUPPORT', Flags.CAMPAIGN, 77),
    rec(551133330000n, 66, 'COLLECTION', Flags.VERIFIED_ORG, 40),
  ]],
  ['55-21', [
    rec(5521911112222n, 85, 'PIX_SCAM', 0, 120),
    rec(5521933334444n, 62, 'SILENT_CALL', Flags.DISPUTED, 7),
  ]],
  ['55-ng', [
    rec(553031234567n, 70, 'TELEMARKETING', 0, 900),
  ]],
]);

const created = day('2026-10-07');
const V1 = 2026100600;
const V2 = 2026100700;
const base = { createdAt: created, ttlDays: 3650, keyId: 'test-2026', privateKey };
const d1 = buildDataset({ ...base, version: V1, current: v1 });
const d2 = buildDataset({ ...base, version: V2, current: v2, previous: v1, previousVersion: V1 });

rmSync(out, { recursive: true, force: true });
function writeDataset(dir: string, d: { manifestBytes: Buffer; signature: string; files: Map<string, Buffer> }) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), d.manifestBytes);
  writeFileSync(join(dir, 'manifest.json.sig'), d.signature);
  for (const [p, bytes] of d.files) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), bytes);
  }
}
writeDataset(join(out, 'v1'), d1);
writeDataset(join(out, 'v2'), d2);

// Casos inválidos: manifest adulterado após assinatura, chave desconhecida, rollback, expirado, path traversal.
const tampered = Buffer.from(d2.manifestBytes.toString('utf8').replace('"record_count": 7', '"record_count": 8'));
const invalid = join(out, 'invalid');
mkdirSync(invalid, { recursive: true });
writeFileSync(join(invalid, 'tampered.manifest.json'), tampered);
writeFileSync(join(invalid, 'tampered.manifest.json.sig'), d2.signature);

const resign = (name: string, m: Manifest) => {
  const s = signManifest(m, privateKey);
  writeFileSync(join(invalid, `${name}.manifest.json`), s.bytes);
  writeFileSync(join(invalid, `${name}.manifest.json.sig`), s.signature);
};
resign('unknown-key', { ...d2.manifest, key_id: 'nobody' });
resign('expired', { ...d2.manifest, expires_at: '2026-01-01T00:00:00.000Z' });
resign('path-traversal', { ...d2.manifest, shards: [{ ...d2.manifest.shards[0], path: 'brazil/../../etc/passwd.bin.gz' }] });
resign('bad-compression', { ...d2.manifest, compression: 'zstd' as 'gzip' });

const vectors = {
  description: 'Gerado por packages/datasets/scripts/gen-test-vectors.ts — não editar à mão.',
  now: '2026-10-07T12:00:00Z',
  trusted_keys: { 'test-2026': pubRaw.toString('base64') },
  valid: [
    { dir: 'v1', installed_version: null, expect: 'OK', version: V1 },
    { dir: 'v2', installed_version: V1, expect: 'OK', version: V2 },
    { dir: 'v1', installed_version: V2, expect: 'ROLLBACK' },
  ],
  invalid: [
    { file: 'invalid/tampered', expect: 'BAD_SIGNATURE' },
    { file: 'invalid/unknown-key', expect: 'UNKNOWN_KEY' },
    { file: 'invalid/expired', expect: 'EXPIRED' },
    { file: 'invalid/path-traversal', expect: 'BAD_PATH' },
    { file: 'invalid/bad-compression', expect: 'UNSUPPORTED_COMPRESSION' },
  ],
  lookups_after_v2: [
    { number: '5511900000001', found: true, score: 95, category: 'BANK_SCAM', flags: Flags.CAMPAIGN },
    { number: '5511900000002', found: false },
    { number: '5511900000004', found: true, score: 88, category: 'FAKE_SUPPORT', flags: Flags.CAMPAIGN },
    { number: '551133330000', found: true, score: 66, category: 'COLLECTION', flags: Flags.VERIFIED_ORG },
    { number: '5521933334444', found: true, score: 62, category: 'SILENT_CALL', flags: Flags.DISPUTED },
    { number: '558001234567', found: false },
    { number: '553031234567', found: true, score: 70, category: 'TELEMARKETING', flags: 0 },
    { number: '5599999999999', found: false },
  ],
};
writeFileSync(join(out, 'vectors.json'), `${JSON.stringify(vectors, null, 2)}\n`);
writeFileSync(join(out, 'TEST_KEY.json'), `${JSON.stringify({
  warning: 'CHAVE DE TESTE PÚBLICA. Builds release DEVEM rejeitar key_id test-*.',
  key_id: 'test-2026',
  public_key_b64: pubRaw.toString('base64'),
  seed_b64: seed.toString('base64'),
}, null, 2)}\n`);
console.log(`vetores gerados em ${out}`);
