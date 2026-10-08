import { createHmac } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isIP } from 'node:net';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly extra: Record<string, unknown>;
  constructor(status: number, code: string, message?: string, extra: Record<string, unknown> = {}) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export interface Reply {
  status?: number;
  body?: unknown;
  raw?: { contentType: string; data: Buffer | string };
  headers?: Record<string, string>;
}

export interface Ctx {
  req: IncomingMessage;
  url: URL;
  params: Record<string, string>;
  /** HMAC do prefixo de rede (/24, /48) para limites de taxa — o IP bruto nunca sai daqui. */
  network: string;
  /** HMAC do prefixo usado na reputação (/24, IPv6 /32). */
  reputationNetwork: string;
  body(): Promise<Record<string, unknown>>;
}

type Handler = (ctx: Ctx) => Promise<Reply>;

interface Route {
  method: string;
  parts: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  on(method: string, path: string, handler: Handler): this {
    this.routes.push({ method, parts: path.split('/').filter(Boolean), handler });
    return this;
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | 'METHOD' | null {
    const parts = pathname.split('/').filter(Boolean);
    let methodMismatch = false;
    for (const r of this.routes) {
      if (r.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length && ok; i++) {
        const p = r.parts[i];
        if (p.startsWith(':')) {
          try {
            params[p.slice(1)] = decodeURIComponent(parts[i]);
          } catch {
            ok = false;
          }
        } else ok = p === parts[i];
      }
      if (!ok) continue;
      if (r.method !== method) {
        methodMismatch = true;
        continue;
      }
      return { handler: r.handler, params };
    }
    return methodMismatch ? 'METHOD' : null;
  }
}

const MAX_BODY = 16 * 1024;

export async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const type = req.headers['content-type'] ?? '';
  if (!type.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'PAYLOAD_TOO_LARGE');
    chunks.push(chunk as Buffer);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'INVALID_JSON');
  return parsed as Record<string, unknown>;
}

/**
 * IP do cliente. Com N proxies confiáveis, vale a entrada de X-Forwarded-For escrita pelo mais externo
 * (N-ésima a partir da direita); entradas mais à esquerda vêm do cliente e são ignoradas.
 */
export function clientIp(req: IncomingMessage, opts: { trustProxyHops: number; clientIpHeader: string | null }): string {
  const socketIp = req.socket.remoteAddress ?? '0.0.0.0';
  if (opts.trustProxyHops === 0) return socketIp;
  if (opts.clientIpHeader) {
    const v = req.headers[opts.clientIpHeader];
    const ip = (Array.isArray(v) ? v[0] : v ?? '').trim();
    if (isIP(ip)) return ip;
  }
  const xff = req.headers['x-forwarded-for'];
  const hops = (Array.isArray(xff) ? xff.join(',') : xff ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const ip = hops[hops.length - opts.trustProxyHops];
  return ip && isIP(ip) ? ip : socketIp;
}

/** Prefixo /24 (IPv4) ou /48 (IPv6) passado por HMAC: agrupa abuso sem guardar IP. */
export function networkKey(ip: string, secret: Buffer, ipv6Groups = 3): string {
  let prefix: string;
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    prefix = v4.split('.').slice(0, 3).join('.') + '.0/24';
  } else {
    prefix = expandIpv6(ip).slice(0, ipv6Groups).join(':') + `::/${ipv6Groups * 16}`;
  }
  return createHmac('sha256', secret).update(prefix).digest('hex').slice(0, 32);
}

function expandIpv6(ip: string): string[] {
  const [head, tail = ''] = ip.split('%')[0].split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const fill = ip.includes('::') ? Array(Math.max(0, 8 - h.length - t.length)).fill('0') : [];
  return [...h, ...fill, ...t].map((g) => g.toLowerCase().replace(/^0+(?=.)/, ''));
}

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'permissions-policy': 'interest-cohort=()',
};

export function send(res: ServerResponse, reply: Reply): void {
  const status = reply.status ?? 200;
  const headers: Record<string, string> = { ...SECURITY_HEADERS, 'cache-control': 'no-store', ...reply.headers };
  if (reply.raw) {
    headers['content-type'] = reply.raw.contentType;
    res.writeHead(status, headers).end(reply.raw.data);
    return;
  }
  if (reply.body === undefined) {
    res.writeHead(status, headers).end();
    return;
  }
  headers['content-type'] = 'application/json; charset=utf-8';
  res.writeHead(status, headers).end(JSON.stringify(reply.body));
}
