/**
 * Extração e análise de URLs de SMS (M4).
 * Detecta: encurtadores, hosts IP, http inseguro, TLDs abusados, homoglifos.
 * Sem dependências externas — regex próprias, cobertas por testes.
 */
import type { SmsUrlFinding } from './types';

/** Encurtadores mais abusados em smishing BR (lista curada, extensível). */
export const URL_SHORTENERS: ReadonlySet<string> = new Set([
  'bit.ly', 'tinyurl.com', 'cutt.ly', 'shorturl.at', 'rebrand.ly', 'is.gd',
  't.co', 'goo.gl', 'ow.ly', 'buff.ly', 'rb.gy', 'tiny.cc', 'shorte.st',
  's.id', 'lnkd.in', 'urlz.fr', 'shrtco.de',
]);

/** TLDs historicamente abusados em smishing (barato/registro livre). */
export const SUSPICIOUS_TLDS: ReadonlySet<string> = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'buzz', 'click', 'icu',
]);

/** Domínios frequentemente impersonados por golpistas (instituições BR). */
export const IMPERSONATED_DOMAINS: readonly string[] = [
  'nubank', 'itau', 'bradesco', 'bb.com', 'bancodobrasil', 'caixa', 'santander',
  'inter', 'c6bank', 'picpay', 'mercadopago', 'mercadolivre', 'amazon', 'correios',
  'gov', 'anatel', 'receita', 'clearsale', 'pagarme',
];

/** TLDs legítimos das instituições acima (host falso = domínio legítimo com outro TLD). */
const TRUSTED_TLDS: ReadonlySet<string> = new Set([
  'com.br', 'br', 'gov.br', 'com', 'net', 'io', 'co',
]);

/** Caracteres Unicode que parecem latinos mas não são (homoglifos comuns). */
const HOMOGLYPHS: ReadonlyMap<string, string> = new Map([
  ['\u0430', 'a (cirílico)'], // а
  ['\u0435', 'e (cirílico)'], // е
  ['\u043e', 'o (cirílico)'], // о
  ['\u0440', 'p (cirílico)'], // р
  ['\u0441', 'c (cirílico)'], // с
  ['\u0443', 'y (cirílico)'], // у
  ['\u0445', 'x (cirílico)'], // х
  ['\u0501', 'd (cirílico)'], // ԁ
  ['\u01c3', '! (latina)'],   // ǃ
  ['\u0261', 'g (latina)'],   // ɡ
]);

/** Regex de URL: com scheme, com www, ou domínio com caminho (bit.ly/abc). */
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"']+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s<>"']*/gi;

/** Regex de host IPv4 (qualquer octeto — validação de range à parte). */
const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function extractUrls(body: string): SmsUrlFinding[] {
  const matches = body.match(URL_REGEX) ?? [];
  const seen = new Set<string>();
  const findings: SmsUrlFinding[] = [];

  for (const raw of matches) {
    // Remove pontuação final comum em frases ("...acesse bit.ly/abc.")
    const cleaned = raw.replace(/[.,;:!?)\]]+$/, '');
    const normalized = cleaned.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const host = extractHost(cleaned);
    const isIpHost = IPV4_REGEX.test(host) && host.split('.').every((o) => Number(o) <= 255);
    const parts = host.split('.').filter(Boolean);
    const tld = parts.length >= 2 ? parts.slice(-2).join('.') : parts[parts.length - 1] ?? '';
    const lastTld = parts[parts.length - 1] ?? '';

    const homoglyphs = [...host].filter((ch) => HOMOGLYPHS.has(ch)).map((ch) => HOMOGLYPHS.get(ch)!);

    findings.push({
      raw: cleaned,
      normalized,
      host,
      isShortener: URL_SHORTENERS.has(host),
      isIpHost,
      isHttp: normalized.startsWith('http://'),
      isPunycode: /(^|\.)xn--/.test(host),
      suspiciousTld: SUSPICIOUS_TLDS.has(lastTld),
      suspiciousDomain: !isIpHost && isImpersonatedDomain(host),
      homoglyphs,
    });
  }

  return findings;
}

function extractHost(url: string): string {
  let h = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  // Se não tinha scheme, www. já removido; host vai até a primeira barra
  h = h.split('/')[0];
  h = h.split('?')[0];
  h = h.split('#')[0];
  // Remove porta
  h = h.split(':')[0];
  return h.toLowerCase();
}

/**
 * Detecta impersonação: host contém marca protegida mas não é o domínio oficial da marca.
 * Regra: a marca deve estar no domínio registrável (os 2 últimos labels) para ser oficial;
 * marca só em subdomínio ou em TLD não-oficial = impersonação.
 * Ex.: 'nubank-promocoes.xyz', 'itau-seguranca.com', 'bradesco.tk' → true.
 * 'nubank.com.br', 'conta.itau.com.br' → false.
 */
export function isImpersonatedDomain(host: string): boolean {
  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return false;

  // Domínio registrável = últimos 2 labels (ou 3 para .com.br/.gov.br)
  const twoLabelTld = /^(com|gov|org|net|edu)\.br$/.test(parts.slice(-2).join('.'));
  const registrable = twoLabelTld ? parts.slice(-3).join('.') : parts.slice(-2).join('.');
  const subdomain = host.slice(0, host.length - registrable.length).replace(/\.$/, '');

  for (const brand of IMPERSONATED_DOMAINS) {
    if (brand.includes('.')) {
      // Marca com domínio oficial completo (ex.: 'bb.com', 'gov.br')
      const official = brand === 'gov' ? 'gov.br' : brand;
      if (registrable === official || registrable.endsWith('.' + official) || host.endsWith('.' + official)) {
        continue; // domínio oficial da marca — não é impersonação
      }
      const officialBase = official.replace(/\.(com\.br|com|br)$/, '');
      if (host.includes(officialBase)) return true;
    } else {
      // Marca simples (ex.: 'nubank', 'itau')
      const officialHosts = BRAND_OFFICIAL_HOSTS.get(brand);
      if (officialHosts?.some((h) => registrable === h || host === h)) continue;
      if (registrable.includes(brand) || subdomain.includes(brand)) {
        // marca presente, mas domínio registrável não é o oficial
        if (!officialHosts?.some((h) => registrable === h)) return true;
      }
    }
  }
  return false;
}

/** Domínios oficiais conhecidos por marca (o que NÃO é impersonação). */
const BRAND_OFFICIAL_HOSTS: ReadonlyMap<string, readonly string[]> = new Map([
  ['nubank', ['nubank.com.br']],
  ['itau', ['itau.com.br']],
  ['bradesco', ['bradesco.com.br']],
  ['bb.com', ['bb.com.br']],
  ['bancodobrasil', ['bb.com.br']],
  ['caixa', ['caixa.gov.br']],
  ['santander', ['santander.com.br']],
  ['inter', ['bancointer.com.br']],
  ['c6bank', ['c6bank.com.br']],
  ['picpay', ['picpay.com']],
  ['mercadopago', ['mercadopago.com.br', 'mercadopago.com']],
  ['mercadolivre', ['mercadolivre.com.br', 'mercadolivre.com']],
  ['amazon', ['amazon.com.br']],
  ['correios', ['correios.com.br']],
  ['gov', ['gov.br']],
  ['anatel', ['gov.br']],
  ['receita', ['gov.br']],
]);

/** Detecta homoglifos Unicode em qualquer texto (não só host). */
export function findHomoglyphs(text: string): string[] {
  return [...text].filter((ch) => HOMOGLYPHS.has(ch)).map((ch) => HOMOGLYPHS.get(ch)!);
}

/** Normaliza o texto: lowercase, remove tracking params e espaços extras. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\s+/g, ' ')
    .trim();
}
