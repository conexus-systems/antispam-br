/**
 * Tipos do SMS Scam Engine (M4) — análise local de mensagens.
 * Puro (sem imports de RN), seguindo o padrão de src/core/types.ts.
 */

export type SmsVerdict = 'SAFE' | 'SUSPECT' | 'SCAM';

export type SmsSignalReason =
  | 'URL_SHORTENER'
  | 'IP_URL'
  | 'HOMOGLYPH'
  | 'SUSPICIOUS_TLD'
  | 'SUSPICIOUS_DOMAIN'
  | 'HTTP_INSECURE'
  | 'PIX_KEY'
  | 'BOLETO_CODE'
  | 'BANK_IMPERSONATION'
  | 'DELIVERY_FEE'
  | 'FAKE_SUPPORT'
  | 'URGENCY'
  | 'PASSWORD_REQUEST'
  | 'OTP_REQUEST'
  | 'OTP_LEGIT_SENDER'
  | 'MONEY_PRESSURE'
  | 'SENDER_UNKNOWN'
  | 'NO_SIGNAL';

export interface SmsUrlFinding {
  /** URL como aparece no texto. */
  raw: string;
  /** URL normalizada para análise (lowercase, sem tracking params). */
  normalized: string;
  /** Host extraído (lowercase). */
  host: string;
  isShortener: boolean;
  isIpHost: boolean;
  isHttp: boolean;
  suspiciousTld: boolean;
  suspiciousDomain: boolean;
  /** Host em punycode (xn--) — IDN, possível disfarce homoglifo. */
  isPunycode: boolean;
  /** Homoglifos encontrados no host (caracteres confundíveis com latinos). */
  homoglyphs: string[];
}

export interface SmsInput {
  /** Remetente como exibido (pode ser texto de "sender ID", ex.: NUBANK). */
  sender?: string | null;
  body: string;
  at?: Date;
}

export interface SmsAnalysis {
  verdict: SmsVerdict;
  /** Risk score 0–100. */
  score: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  signals: SmsSignalReason[];
  urls: SmsUrlFinding[];
  /** Explicação legível (pt-BR) — sempre explicável. */
  explanation: string[];
  /** Hash do texto normalizado — permite telemetria opt-in sem enviar o conteúdo. */
  bodyHash: string;
}

/** Categorias de golpe detectáveis por SMS (alinham com ReportCategory/community). */
export type SmsScamCategory =
  | 'PIX_SCAM'
  | 'PHISHING'
  | 'BANK_SCAM'
  | 'DELIVERY_SCAM'
  | 'FAKE_SUPPORT'
  | 'GENERIC';
