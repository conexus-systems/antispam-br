/**
 * Dispositivos pseudônimos (ADR 0006 §2): sem conta, sem e-mail, sem telefone.
 * Registro exige prova de trabalho sobre um desafio assinado pelo servidor e de uso único.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { HttpError } from './http.ts';
import { hit, peek } from './limits.ts';

const CHALLENGE_TTL_MS = 10 * 60_000;

export interface Device {
  id: number;
  /** Rede (HMAC do prefixo) em que o dispositivo foi registrado. */
  network: string;
  ageDays: number;
  agreements: number;
  disagreements: number;
  quarantined: boolean;
}

function mac(secret: Buffer, data: string): string {
  return createHmac('sha256', secret).update(`pow:${data}`).digest('base64url');
}

export function issueChallenge(config: Config, now = Date.now()): { challenge: string; bits: number; expires_at: string } {
  const body = `${now}.${randomBytes(16).toString('base64url')}`;
  return {
    challenge: `${body}.${mac(config.serverSecret, body)}`,
    bits: config.powBits,
    expires_at: new Date(now + CHALLENGE_TTL_MS).toISOString(),
  };
}

export function leadingZeroBits(buf: Buffer): number {
  let n = 0;
  for (const byte of buf) {
    if (byte === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(byte) - 24;
  }
  return n;
}

/** Usado pelos clientes e pelos testes: acha `solution` com sha256(challenge:solution) ≥ bits zeros. */
export function solveChallenge(challenge: string, bits: number): string {
  for (let i = 0; ; i++) {
    const s = i.toString(36);
    if (leadingZeroBits(createHash('sha256').update(`${challenge}:${s}`).digest()) >= bits) return s;
  }
}

function verifyChallenge(config: Config, challenge: string, solution: string, now: number): void {
  const parts = challenge.split('.');
  if (parts.length !== 3 || solution.length === 0 || solution.length > 64) throw new HttpError(400, 'INVALID_CHALLENGE');
  const [ts, nonce, sig] = parts;
  const expected = Buffer.from(mac(config.serverSecret, `${ts}.${nonce}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new HttpError(400, 'INVALID_CHALLENGE');
  const issued = Number(ts);
  if (!Number.isFinite(issued) || now - issued > CHALLENGE_TTL_MS || issued - now > 60_000) {
    throw new HttpError(400, 'CHALLENGE_EXPIRED');
  }
  const digest = createHash('sha256').update(`${challenge}:${solution}`).digest();
  if (leadingZeroBits(digest) < config.powBits) throw new HttpError(400, 'INSUFFICIENT_WORK');
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest();

/**
 * `network` limita taxa (/24, /48); `reputationNetwork` agrupa para o teto de peso (/24, IPv6 /32:
 * um bloco IPv6 inteiro de um provedor/atacante vale como uma rede).
 */
export async function registerDevice(
  db: Db, config: Config, network: string, reputationNetwork: string, body: Record<string, unknown>, now = Date.now(),
): Promise<{ device_token: string }> {
  const { challenge, solution } = body;
  if (typeof challenge !== 'string' || typeof solution !== 'string') throw new HttpError(400, 'INVALID_CHALLENGE');
  verifyChallenge(config, challenge, solution, now);
  await hit(db, `reg:net:${network}`, 86_400, config.limits.networkRegistrationsPerDay);

  const used = await db.query(
    'INSERT INTO pow_challenges_used (challenge_sha256) VALUES ($1) ON CONFLICT DO NOTHING',
    [createHash('sha256').update(challenge).digest()],
  );
  if (used.rowCount === 0) throw new HttpError(409, 'CHALLENGE_REUSED');

  const token = randomBytes(32).toString('base64url');
  await db.query('INSERT INTO devices (token_sha256, network_hash) VALUES ($1, $2)', [tokenHash(token), reputationNetwork]);
  return { device_token: token };
}

export async function authenticate(db: Db, config: Config, network: string, req: IncomingMessage): Promise<Device> {
  const header = req.headers.authorization ?? '';
  const m = /^Device ([A-Za-z0-9_-]{43})$/.exec(header);
  if (!m) throw new HttpError(401, 'DEVICE_TOKEN_REQUIRED');
  const failKey = `authfail:net:${network}`;
  if (await peek(db, failKey, 60) >= config.limits.networkAuthFailuresPerMinute) {
    throw new HttpError(429, 'RATE_LIMITED', undefined, { retry_after_seconds: 60 });
  }
  const { rows } = await db.query<{
    id: string; network_hash: string; age_days: number; agreements: number; disagreements: number; quarantined: boolean;
  }>(
    `UPDATE devices SET last_seen_at = now() WHERE token_sha256 = $1
     RETURNING id, network_hash, extract(epoch FROM now() - created_at) / 86400 AS age_days,
               agreements, disagreements, quarantined_at IS NOT NULL AS quarantined`,
    [tokenHash(m[1])],
  );
  if (rows.length === 0) {
    await hit(db, failKey, 60, config.limits.networkAuthFailuresPerMinute);
    throw new HttpError(401, 'DEVICE_TOKEN_INVALID');
  }
  const r = rows[0];
  return {
    id: Number(r.id), network: r.network_hash, ageDays: Number(r.age_days), agreements: r.agreements,
    disagreements: r.disagreements, quarantined: r.quarantined,
  };
}
