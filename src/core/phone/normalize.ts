/**
 * Normalização telefônica focada no Brasil.
 *
 * Formas aceitas (todas viram a mesma forma canônica):
 *   (11) 99999-9999 / 11999999999 / +5511999999999 / 5511999999999
 *   015 11 999999999 (prefixo de operadora 0XX)
 *   0800 123 4567 / 0303 313 0303 / 4004-1234 / 3003-1234
 *   190 (emergência)
 *
 * Design: função PURA, determinística e barata — roda no caminho crítico
 * do CallScreeningService (meta p95 < 100 ms).
 */
import type { NormalizedPhone, PhoneKind } from '../types';
import { isEmergencyNumber } from './emergency';

/** Serviços com tarifa local (discados nacionalmente sem DDD). */
const SERVICE_PREFIXES = ['3003', '3004', '4002', '4003', '4004', '4020', '4024'] as const;

/** Serviços de valor agregado / cobrança direta. */
const PREMIUM_PREFIXES = ['0303', '0500', '0900'] as const;

export function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D+/g, '');
}

function build(
  raw: string,
  canonical: string,
  kind: PhoneKind,
  extra?: Partial<Pick<NormalizedPhone, 'countryPrefix' | 'ddd'>>,
): NormalizedPhone {
  return {
    raw,
    canonical,
    digits: canonical.replace(/\+/g, ''),
    kind,
    isBrazilian:
      kind === 'emergency' ||
      canonical.startsWith('+55') ||
      (!canonical.startsWith('+') && canonical.length > 0),
    ...extra,
  };
}

/** Interpretar uma sequência nacional brasileira (DDD + número). */
function parseBrazilNational(raw: string, national: string): NormalizedPhone | null {
  // 10 ou 11 dígitos: DDD (2) + fixo (8, começa 2-5) ou celular (9, começa 9)
  if (national.length === 10 || national.length === 11) {
    const ddd = national.slice(0, 2);
    const rest = national.slice(2);
    const dddNum = Number(ddd);
    if (dddNum < 11 || dddNum > 99) return null;
    const isMobile = national.length === 11 && rest.startsWith('9');
    const isLandline = national.length === 10 && /^[2-5]/.test(rest);
    if (!isMobile && !isLandline && national.length === 11) return null; // 11 dígitos fora do padrão 9xxxxxxxx
    const kind: PhoneKind = isMobile ? 'mobile' : isLandline ? 'landline' : 'unknown';
    return build(raw, `+55${ddd}${rest}`, kind, { countryPrefix: '55', ddd });
  }
  // 8 dígitos: serviço de tarifa local (4004-1234) sem DDD
  if (national.length === 8) {
    if ((SERVICE_PREFIXES as readonly string[]).some((p) => national.startsWith(p))) {
      return build(raw, national, 'service');
    }
  }
  return null;
}

export function normalizePhone(raw: string): NormalizedPhone {
  const trimmed = (raw ?? '').trim();

  // Número oculto / restrito / vazio
  if (!trimmed) return build(raw, '', 'hidden');

  const digits = onlyDigits(trimmed);
  if (!digits) return build(raw, '', 'hidden');

  // Emergências (2–3 dígitos)
  if (isEmergencyNumber(digits)) return build(raw, digits, 'emergency');

  // Serviço de tarifa local sem DDD (4004-1234 / 3003-1234)
  if (digits.length === 8 && (SERVICE_PREFIXES as readonly string[]).some((p) => digits.startsWith(p))) {
    return build(raw, digits, 'service');
  }

  // Códigos curtos genéricos (ex.: 3322, *3486)
  if (digits.length <= 5) return build(raw, digits, 'shortCode');

  // Serviços especiais com prefixo 0 (0800 / 0303 / 0500 / 0900)
  if (digits.startsWith('0')) {
    const special = digits.slice(0, 4);
    const rest8 = digits.slice(4);
    if (special === '0800' && rest8.length >= 6 && rest8.length <= 8) {
      return build(raw, digits, 'tollFree');
    }
    if ((PREMIUM_PREFIXES as readonly string[]).includes(special) && rest8.length >= 6) {
      return build(raw, digits, 'premium');
    }
    // Prefixo de seleção de operadora: 0 + 2 dígitos + nacional (ex.: 0151199999999)
    const afterOperator = digits.slice(3);
    if (afterOperator.length >= 10 && afterOperator.length <= 11) {
      const parsed = parseBrazilNational(raw, afterOperator);
      if (parsed) return parsed;
    }
    if (digits.length > 12) {
      // desconhecido com prefixo 0 — manter como está
      return build(raw, `+${digits}`, 'unknown', { countryPrefix: undefined });
    }
  }

  // +55 / 55: Brasil
  if (digits.startsWith('55')) {
    const national = digits.slice(2);
    if (national.length === 10 || national.length === 11) {
      const parsed = parseBrazilNational(raw, national);
      if (parsed) return parsed;
    }
  }

  // Nacional brasileiro sem +55 (11 dígitos celular / 10 fixo)
  if (digits.length === 10 || digits.length === 11) {
    const parsed = parseBrazilNational(raw, digits);
    if (parsed) return parsed;
  }

  // Internacional: canonical '+<digits>'
  return build(raw, `+${digits}`, 'international', {
    countryPrefix: digits.slice(0, Math.min(3, digits.length - 6)),
  });
}

/** Formata um número canônico para exibição amigável (pt-BR). */
export function formatDisplay(canonical: string): string {
  const n = normalizePhone(canonical);
  if (n.kind === 'mobile' && n.ddd) {
    const rest = n.canonical.slice(5); // após '+55DD'
    return `(${n.ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  if (n.kind === 'landline' && n.ddd) {
    const rest = n.canonical.slice(5); // após '+55DD'
    return `(${n.ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  if (n.kind === 'tollFree') return `0800 ${n.canonical.slice(4, 7)} ${n.canonical.slice(7)}`;
  if (n.kind === 'premium') return `${n.canonical.slice(0, 4)} ${n.canonical.slice(4)}`;
  return n.canonical || 'Número oculto';
}

export const normalizeBrazilian = normalizePhone;
