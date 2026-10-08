export interface Limits {
  /** Denúncias + votos + contestações por dispositivo. */
  deviceActionsPerDay: number;
  deviceActionsPerMinute: number;
  /** Contestações têm limite próprio: abrir fila de moderação é mais caro que denunciar. */
  deviceContestsPerDay: number;
  /** Por rede (/24 IPv4, /48 IPv6), somando todos os dispositivos. */
  networkActionsPerDay: number;
  networkContestsPerDay: number;
  networkRegistrationsPerDay: number;
  /** Consultas públicas (portal / hash-prefix) por rede. */
  networkLookupsPerMinute: number;
  /** Tokens de dispositivo inválidos por rede (força bruta). */
  networkAuthFailuresPerMinute: number;
}

export interface Config {
  port: number;
  databaseUrl: string;
  /** Segredo de servidor: HMAC de desafios PoW, de prefixos de rede e de referências de denúncia. */
  serverSecret: Buffer;
  powBits: number;
  /** token → nome do moderador. Vazio = endpoints de moderação desligados. */
  moderators: Map<string, string>;
  /**
   * Proxies confiáveis à frente da API (ingress = 1). 0 = usa o IP do socket.
   * O pod só deve aceitar tráfego do ingress (NetworkPolicy), senão o cabeçalho é forjável.
   */
  trustProxyHops: number;
  /** Cabeçalho com o IP do cliente posto pela borda (ex.: cf-connecting-ip). Tem prioridade sobre XFF. */
  clientIpHeader: string | null;
  webDir: string | null;
  /** Janela aceita para o timestamp do cliente (anti-replay). */
  clockSkewMs: number;
  /** Peso somado de contestações pendentes a partir do qual a publicação é suspensa. */
  contestSuspendWeight: number;
  limits: Limits;
}

export const DEFAULT_LIMITS: Limits = {
  deviceActionsPerDay: 20,
  deviceActionsPerMinute: 3,
  deviceContestsPerDay: 3,
  networkActionsPerDay: 200,
  networkContestsPerDay: 20,
  networkRegistrationsPerDay: 20,
  networkLookupsPerMinute: 120,
  networkAuthFailuresPerMinute: 30,
};

/** MODERATION_TOKENS="tiago:<token>,ana:<token>" — cada token com ≥ 32 caracteres. */
export function parseModerators(raw: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const i = entry.indexOf(':');
    const name = entry.slice(0, i);
    const token = entry.slice(i + 1);
    if (i <= 0 || !/^[\w.-]{2,32}$/.test(name) || token.length < 32) {
      throw new Error('MODERATION_TOKENS inválido: use nome:token (token ≥ 32 caracteres)');
    }
    out.set(token, name);
  }
  return out;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const secret = env.SERVER_SECRET ?? '';
  if (secret.length < 32) throw new Error('SERVER_SECRET ausente ou curto (mínimo 32 caracteres)');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL ausente');
  const hops = Number(env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(hops) || hops < 0 || hops > 5) throw new Error('TRUST_PROXY_HOPS deve ser 0..5');
  return {
    port: Number(env.PORT ?? 8787),
    databaseUrl: env.DATABASE_URL,
    serverSecret: Buffer.from(secret, 'utf8'),
    powBits: Number(env.POW_BITS ?? 20),
    moderators: parseModerators(env.MODERATION_TOKENS),
    trustProxyHops: hops,
    clientIpHeader: env.CLIENT_IP_HEADER?.toLowerCase() || null,
    webDir: env.WEB_DIR ?? null,
    clockSkewMs: 10 * 60_000,
    contestSuspendWeight: 0.5,
    limits: DEFAULT_LIMITS,
  };
}
