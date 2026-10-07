/**
 * DATASET SIGNING — M8.
 *
 * Manifests assinados com Ed25519 (via @noble/curves). O app recusa dataset
 * com hash inválido ou assinatura incorreta (missão §DISTRIBUIÇÃO).
 *
 * Build do servidor: assina. Cliente (app): verifica com chave pública pinada.
 */

import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

export interface DatasetFileEntry {
  path: string;       // ex.: 'brazil/55-11.bin.zst'
  sha256: string;     // hex
  bytes: number;
  records: number;
}

export interface DatasetManifest {
  version: string; // semver
  timestamp: string; // ISO
  previous_version: string | null;
  record_count: number;
  license: string;
  files: DatasetFileEntry[];
  signature: {
    alg: 'Ed25519';
    public_key_id: string;
    value: string; // hex, 64 bytes
  };
}

export interface SignerConfig {
  /** Chave privada Ed25519 hex (32 bytes). Em produção: KMS/HSM, nunca em disco do repo. */
  privateKeyHex: string;
  publicKeyId: string;
}

/** Gera par de chaves (uso: bootstrap de ambiente / testes). */
export function generateKeyPair(): { privateKeyHex: string; publicKeyHex: string } {
  const priv = ed25519.utils.randomPrivateKey();
  const pub = ed25519.getPublicKey(priv);
  return { privateKeyHex: bytesToHex(priv), publicKeyHex: bytesToHex(pub) };
}

/** Cânon do manifest assinado: tudo exceto o campo signature, com chaves ordenadas. */
export function manifestCanonicalBytes(manifest: Omit<DatasetManifest, 'signature'>): Uint8Array {
  const canonical = JSON.stringify(manifest, Object.keys(manifest as unknown as Record<string, unknown>).sort());
  return utf8ToBytes(canonical);
}

export function signManifest(
  manifest: Omit<DatasetManifest, 'signature'>,
  config: SignerConfig,
): DatasetManifest {
  const bytes = manifestCanonicalBytes(manifest);
  const sig = ed25519.sign(bytes, hexToBytes(config.privateKeyHex));
  return {
    ...manifest,
    signature: {
      alg: 'Ed25519',
      public_key_id: config.publicKeyId,
      value: bytesToHex(sig),
    },
  };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'BAD_SIGNATURE_FORMAT' | 'SIGNATURE_MISMATCH' | 'FILE_HASH_MISMATCH' | 'VERSION_BACKWARD' };

/**
 * Verificação completa (usada pelo app antes de aceitar dataset):
 * 1. Formato da assinatura; 2. Assinatura Ed25519 sobre o cânon; 3. SHA-256 de cada arquivo;
 * 4. Versionamento monotônico (anti-rollback).
 */
export function verifyManifest(
  manifest: DatasetManifest,
  fileHashes: Record<string, string>, // path → sha256 hex do arquivo baixado
  publicKeyHex: string,
  previousVersion?: string | null,
): VerifyResult {
  const sigBytes = (() => {
    try {
      const b = hexToBytes(manifest.signature.value);
      if (b.length !== 64) return null;
      return b;
    } catch {
      return null;
    }
  })();
  if (!sigBytes) return { ok: false, reason: 'BAD_SIGNATURE_FORMAT' };

  const { signature: _sig, ...rest } = manifest;
  const canonical = JSON.stringify(rest, Object.keys(rest as unknown as Record<string, unknown>).sort());
  const msg = utf8ToBytes(canonical);
  const pub = hexToBytes(publicKeyHex);

  let sigOk = false;
  try {
    sigOk = ed25519.verify(sigBytes, msg, pub);
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { ok: false, reason: 'SIGNATURE_MISMATCH' };

  for (const f of manifest.files) {
    if (fileHashes[f.path] !== f.sha256) return { ok: false, reason: 'FILE_HASH_MISMATCH' };
  }

  if (previousVersion && versionLte(manifest.version, previousVersion)) {
    return { ok: false, reason: 'VERSION_BACKWARD' };
  }

  return { ok: true };
}

/** semver compare: retorna true se a <= b. */
export function versionLte(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return false;
  }
  return true;
}

/** Hash de arquivo (hex) — utilidade p/ build dos .bin.zst. */
export function fileHashHex(content: Uint8Array): string {
  return bytesToHex(sha256(content));
}
