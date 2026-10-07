/**
 * SMS Scam Engine (M4) — pipeline:
 *   SMS → normalization → sender reputation → URL extraction → text heuristics
 *      → risk score → SAFE / SUSPECT / SCAM
 *
 * PRINCÍPIOS (mission §SMS):
 * - Tudo LOCAL. Nunca enviar o texto completo para servidor por padrão (só bodyHash opt-in).
 * - Conservador: SCAM exige evidência forte; erro pior é acusar mensagem legítima.
 * - Explicabilidade: toda análise carrega signals + explanation legível (pt-BR).
 */
import { sha256 } from '../security/sha256';
import type { SmsAnalysis, SmsInput, SmsSignalReason, SmsUrlFinding } from './types';
import { extractUrls, findHomoglyphs, normalizeText } from './urlExtractor';
import { analyzeTextSignals, isLegitOtpSender, isShortCodeSender } from './heuristics';

/** Thresholds configuráveis (exigência §REPUTATION: configurável). */
export const SMS_THRESHOLDS = {
  /** score >= SUSPECT_AT → SUSPECT */
  SUSPECT_AT: 25,
  /** score >= SCAM_AT → SCAM */
  SCAM_AT: 55,
  /** Redução quando o remetente é OTP legítimo conhecido. */
  LEGIT_OTP_BONUS: -15,
  /** Evidência forte de URL maliciosa empurra direto para SCAM com este score mínimo. */
  HARD_URL_EVIDENCE: 40,
  /** Bônus por combinação: encurtador + pressão financeira/urgência (padrão smishing BR). */
  SHORTENER_PLUS_PRESSURE: 20,
} as const;

/** Pesos por sinal de URL. */
const URL_WEIGHTS = {
  shortener: 15,
  ipHost: 30,
  http: 10,
  suspiciousTld: 20,
  suspiciousDomain: 30,
  perHomoglyph: 25,
} as const;

const SIGNAL_LABELS: Record<string, string> = {
  URL_SHORTENER: 'Link encurtado (esconde destino real)',
  IP_URL: 'Link aponta para endereço IP (sem domínio)',
  HOMOGLYPH: 'Caracteres falsificados no domínio (homoglifos Unicode)',
  SUSPICIOUS_TLD: 'Domínio com TLD frequentemente abusado',
  SUSPICIOUS_DOMAIN: 'Domínio finge ser instituição conhecida',
  HTTP_INSECURE: 'Link sem criptografia (http://)',
  PIX_KEY: 'Envolve chave PIX',
  BOLETO_CODE: 'Contém código de boleto',
  BANK_IMPERSONATION: 'Finge ser banco/instituição',
  DELIVERY_FEE: 'Falsa entrega com taxa',
  FAKE_SUPPORT: 'Falsa central de atendimento',
  URGENCY: 'Urgência artificial',
  PASSWORD_REQUEST: 'Pede senha/dados da conta',
  OTP_REQUEST: 'Pede código de verificação',
  OTP_LEGIT_SENDER: 'Remetente conhecido de OTP legítimo',
  MONEY_PRESSURE: 'Pressão financeira',
};

export function analyzeSms(input: SmsInput): SmsAnalysis {
  const signals = new Set<SmsAnalysis['signals'][number]>();
  const explanation: string[] = [];
  let score = 0;

  // ---------- 1. Normalização + URLs ----------
  const body = input.body ?? '';
  const urls: SmsUrlFinding[] = extractUrls(body);
  let urlStrongEvidence = false;

  for (const url of urls) {
    if (url.isShortener) {
      score += URL_WEIGHTS.shortener;
      signals.add('URL_SHORTENER');
      explanation.push(`Link encurtado: ${url.host}`);
    }
    if (url.isIpHost) {
      score += URL_WEIGHTS.ipHost;
      signals.add('IP_URL');
      urlStrongEvidence = true;
      explanation.push(`Link para IP direto: ${url.host}`);
    }
    if (url.isHttp) {
      score += URL_WEIGHTS.http;
      signals.add('HTTP_INSECURE');
      explanation.push('Link sem criptografia (http://)');
    }
    if (url.suspiciousTld) {
      score += URL_WEIGHTS.suspiciousTld;
      signals.add('SUSPICIOUS_TLD');
      explanation.push(`TLD suspeito: ${url.host}`);
    }
    if (url.suspiciousDomain) {
      score += URL_WEIGHTS.suspiciousDomain;
      signals.add('SUSPICIOUS_DOMAIN');
      urlStrongEvidence = true;
      explanation.push(`Domínio finge instituição conhecida: ${url.host}`);
    }
    if (url.isPunycode) {
      score += URL_WEIGHTS.perHomoglyph;
      signals.add('HOMOGLYPH');
      urlStrongEvidence = true;
      explanation.push(`Domínio em punycode/IDN (possível disfarce): ${url.host}`);
    }
    if (url.homoglyphs.length) {
      score += URL_WEIGHTS.perHomoglyph;
      signals.add('HOMOGLYPH');
      urlStrongEvidence = true;
      explanation.push(`Homoglifos no domínio: ${url.homoglyphs.join(', ')}`);
    }
  }

  // ---------- 2. Heurísticas de texto ----------
  const textSignals = analyzeTextSignals(body);
  // Short code numérico de campanha em massa reforça o sinal de marketing
  if (isShortCodeSender(input.sender) && textSignals.some((t) => t.signal === 'MONEY_PRESSURE')) {
    score += 10;
    explanation.push('Remetente é short code de campanha em massa');
  }
  for (const ts of textSignals) {
    score += ts.points;
    signals.add(ts.signal);
    explanation.push(ts.explanation);
  }

  // ---------- 3. Remetente ----------
  const legitOtp = isLegitOtpSender(input.sender);
  if (legitOtp && signals.has('OTP_REQUEST')) {
    score += SMS_THRESHOLDS.LEGIT_OTP_BONUS;
    signals.add('OTP_LEGIT_SENDER');
    explanation.push('Remetente é fonte conhecida de OTP legítimo (score reduzido, não zerado)');
  }
  if (!input.sender && score > 0 && !signals.has('OTP_LEGIT_SENDER')) {
    signals.add('SENDER_UNKNOWN');
  }

  // ---------- 3b. Combinações típicas de smishing BR ----------
  const pressureSignal =
    signals.has('MONEY_PRESSURE') || signals.has('URGENCY') || signals.has('PIX_KEY') || signals.has('DELIVERY_FEE');
  if (signals.has('URL_SHORTENER') && pressureSignal) {
    score += SMS_THRESHOLDS.SHORTENER_PLUS_PRESSURE;
    explanation.push('Link encurtado combinado com pressão financeira/urgência — padrão de smishing');
  }
  if (signals.has('PIX_KEY') && signals.has('URGENCY')) {
    score += SMS_THRESHOLDS.SHORTENER_PLUS_PRESSURE;
    explanation.push('PIX com urgência — padrão clássico de falso PIX');
  }

  // ---------- 4. Verdict ----------
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  let verdict: SmsAnalysis['verdict'] = 'SAFE';
  if (finalScore >= SMS_THRESHOLDS.SCAM_AT || (urlStrongEvidence && finalScore >= SMS_THRESHOLDS.HARD_URL_EVIDENCE)) {
    verdict = 'SCAM';
  } else if (finalScore >= SMS_THRESHOLDS.SUSPECT_AT) {
    verdict = 'SUSPECT';
  }

  const confidence: SmsAnalysis['confidence'] =
    verdict === 'SCAM' ? 'HIGH' : signals.size >= 3 ? 'MEDIUM' : 'LOW';

  // Homoglifos fora de URL também contam
  const bodyHomoglyphs = findHomoglyphs(body);
  if (bodyHomoglyphs.length && !signals.has('HOMOGLYPH')) {
    signals.add('HOMOGLYPH');
    explanation.push('Caracteres homoglifos no texto (possível disfarce)');
  }

  if (!signals.size) signals.add('NO_SIGNAL');

  return {
    verdict,
    score: finalScore,
    confidence,
    signals: [...signals],
    urls,
    explanation: explanation.slice(0, 10),
    bodyHash: sha256(normalizeText(body)),
  };
}
