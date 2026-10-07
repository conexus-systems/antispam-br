/**
 * Normalização de números brasileiros para E.164.
 * Contrato compartilhado com Android/iOS via data/test-vectors/phone-normalization.json.
 */

export type NumberKind =
  | 'MOBILE'
  | 'LANDLINE'
  | 'TOLL_FREE'
  | 'TELEMARKETING'
  | 'SHARED_COST'
  | 'DONATION'
  | 'PREMIUM'
  | 'NON_GEO_UNIQUE'
  | 'EMERGENCY'
  | 'SHORT_CODE'
  | 'INTERNATIONAL'
  | 'LOCAL_NO_DDD'
  | 'HIDDEN'
  | 'INVALID';

export interface NormalizedNumber {
  input: string;
  kind: NumberKind;
  /** E.164 com "+", ou null quando não normalizável. */
  e164: string | null;
  ddd: string | null;
  /** Shard do dataset (55-11, 55-ng, 55-intl) ou null. */
  shard: string | null;
}

export const VALID_DDDS: ReadonlySet<string> = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

/**
 * Códigos 1XX são exclusivos de utilidade pública/emergência (Res. Anatel 749/2022 art. 14 §1º);
 * 10X com extensão (103xx, 105xx) são centrais de operadoras. 112 e 911 também levam à polícia.
 */
export function isEmergencyOrUtility(digits: string): boolean {
  if (digits === '911') return true;
  if (digits.length === 3 && digits[0] === '1') return true;
  return (digits.length === 4 || digits.length === 5) && digits.startsWith('10');
}

/** "+190", "0190", "+55 190" e "55190" também chegam como caller ID e são o mesmo 190. */
function isEmergencyInAnyForm(digits: string): boolean {
  if (digits.length > 8) return false;
  const withoutCountry = digits.startsWith('55') && digits.length > 3 ? digits.slice(2) : digits;
  const trimZeros = (s: string) => s.replace(/^0+/, '');
  return [digits, trimZeros(digits), trimZeros(withoutCountry)].some(
    (d) => d.length >= 3 && d.length <= 5 && isEmergencyOrUtility(d),
  );
}

const NON_GEO_PREFIXES: ReadonlyArray<[string, NumberKind]> = [
  ['0800', 'TOLL_FREE'],
  ['0303', 'TELEMARKETING'],
  ['0300', 'SHARED_COST'],
  ['0500', 'DONATION'],
  ['0900', 'PREMIUM'],
];

const NON_GEO_UNIQUE = /^(300[0-9]|400[0-9]|4020|4062|4090|4091)\d{4}$/;

const HIDDEN_TOKENS = new Set(['', 'anonymous', 'private', 'unknown', 'restricted', 'privado', 'desconhecido']);

function result(input: string, kind: NumberKind, e164: string | null, ddd: string | null): NormalizedNumber {
  let shard: string | null = null;
  if (e164) {
    if (kind === 'MOBILE' || kind === 'LANDLINE') shard = `55-${ddd}`;
    else if (kind === 'INTERNATIONAL') shard = '55-intl';
    else shard = '55-ng';
  }
  return { input, kind, e164, ddd, shard };
}

function fromNational(input: string, national: string): NormalizedNumber {
  if (national.length !== 10 && national.length !== 11) return result(input, 'INVALID', null, null);
  const ddd = national.slice(0, 2);
  if (!VALID_DDDS.has(ddd)) return result(input, 'INVALID', null, null);
  let sub = national.slice(2);
  if (sub.length === 9) {
    if (sub[0] !== '9') return result(input, 'INVALID', null, null);
    return result(input, 'MOBILE', `+55${ddd}${sub}`, ddd);
  }
  const first = sub[0];
  if (first >= '2' && first <= '6') return result(input, 'LANDLINE', `+55${ddd}${sub}`, ddd);
  if (first >= '7' && first <= '9') {
    sub = `9${sub}`;
    return result(input, 'MOBILE', `+55${ddd}${sub}`, ddd);
  }
  return result(input, 'INVALID', null, null);
}

function nonGeo(input: string, digits: string): NormalizedNumber | null {
  for (const [prefix, kind] of NON_GEO_PREFIXES) {
    if (digits.startsWith(prefix) && (digits.length === 11 || digits.length === 10)) {
      return result(input, kind, `+55${digits.slice(1)}`, null);
    }
  }
  return null;
}

/**
 * @param raw número como chega do sistema (caller ID), com ou sem formatação.
 * @param userDdd DDD do próprio usuário — usado só para números locais de 8/9 dígitos.
 */
export function normalize(raw: string | null | undefined, userDdd?: string | null): NormalizedNumber {
  const input = raw ?? '';
  const trimmed = input.trim();
  if (HIDDEN_TOKENS.has(trimmed.toLowerCase())) return result(input, 'HIDDEN', null, null);

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return result(input, 'HIDDEN', null, null);
  if (isEmergencyInAnyForm(digits)) return result(input, 'EMERGENCY', null, null);

  if (hasPlus) {
    if (digits.startsWith('55')) {
      const rest = digits.slice(2);
      const ng = nonGeo(input, `0${rest}`);
      if (ng) return ng;
      if (NON_GEO_UNIQUE.test(rest)) return result(input, 'NON_GEO_UNIQUE', `+55${rest}`, null);
      return fromNational(input, rest);
    }
    if (digits.length >= 8 && digits.length <= 15) return result(input, 'INTERNATIONAL', `+${digits}`, null);
    return result(input, 'INVALID', null, null);
  }

  if (digits.length <= 5) {
    if (isEmergencyOrUtility(digits)) return result(input, 'EMERGENCY', null, null);
    if (digits.length >= 4) return result(input, 'SHORT_CODE', null, null);
    return result(input, 'INVALID', null, null);
  }

  if (digits.startsWith('00')) {
    // 00 + CSP (2 dígitos) + código do país
    const intl = digits.slice(4);
    if (intl.startsWith('55')) return normalize(`+${intl}`, userDdd);
    if (intl.length >= 8 && intl.length <= 15) return result(input, 'INTERNATIONAL', `+${intl}`, null);
    return result(input, 'INVALID', null, null);
  }

  if (digits.startsWith('0')) {
    const ng = nonGeo(input, digits);
    if (ng) return ng;
    if (digits.length === 11 || digits.length === 12) return fromNational(input, digits.slice(1));
    if (digits.length === 13 || digits.length === 14) return fromNational(input, digits.slice(3));
    return result(input, 'INVALID', null, null);
  }

  if (NON_GEO_UNIQUE.test(digits)) return result(input, 'NON_GEO_UNIQUE', `+55${digits}`, null);

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return fromNational(input, digits.slice(2));
  }

  if (digits.length === 10 || digits.length === 11) return fromNational(input, digits);

  if (digits.length === 8 || digits.length === 9) {
    if (userDdd && VALID_DDDS.has(userDdd)) return fromNational(input, `${userDdd}${digits}`);
    return result(input, 'LOCAL_NO_DDD', null, null);
  }

  return result(input, 'INVALID', null, null);
}

/** Dígitos E.164 sem "+" como bigint — chave dos registros do dataset. */
export function e164ToKey(e164: string): bigint {
  if (!/^\+\d{8,15}$/.test(e164)) throw new Error(`E.164 inválido: ${e164}`);
  return BigInt(e164.slice(1));
}
