/**
 * SpamScore — combinação auditável de sinais (SPAM-DETECTION-AGENT).
 *
 * PRINCÍPIOS:
 * - Nenhuma fonte decide sozinha (exigência §5).
 * - Algoritmo determinístico, documentado e testável.
 * - BLOCK agressivo exige confiança elevada (§35: pior erro é bloquear ligação legítima).
 */
import type { NormalizedPhone, StirShaken } from '../types';
import { brazilPatternRisk } from '../phone/brazilRules';

export interface ReputationSignal {
  /** Score agregado da base (0–100). */
  score: number;
  reports: number;
  /** 0–1 — denunciantes únicos/recência/confiança histórica. */
  confidence: number;
}

export interface CampaignEvidence {
  /** 0–100 */
  risk: number;
  similarCount: number;
}

export interface ScoreInputs {
  phone: NormalizedPhone;
  reputation?: ReputationSignal | null;
  campaign?: CampaignEvidence | null;
  stirShaken?: StirShaken;
  /** Número já bloqueado antes por decisão própria do usuário. */
  previouslyBlocked?: boolean;
  /** Número já marcado como confiável. */
  previouslyAllowed?: boolean;
}

export interface ScoreBreakdown {
  score: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  contributions: Array<{ label: string; points: number }>;
}

/** Pesos máximos de cada sinal (soma dos teto < 120 permite saturação em casos óbvios). */
export const WEIGHTS = {
  reputation: 55,
  campaign: 30,
  pattern: 45,
  stirPass: -25,
  stirFail: 30,
  previouslyBlocked: 40,
  previouslyAllowed: -60,
} as const;

/** Reputação só pontua com volume mínimo — uma denúncia isolada NUNCA decide. */
const MIN_REPORTS_FOR_SIGNAL = 2;
/** Com confiança baixa, reputação contribui no máximo com: */
const LOW_CONFIDENCE_CAP = 15;

export function computeSpamScore(inputs: ScoreInputs): ScoreBreakdown {
  const contributions: ScoreBreakdown['contributions'] = [];
  let score = 0;

  const rep = inputs.reputation;
  if (rep && rep.reports >= MIN_REPORTS_FOR_SIGNAL) {
    let points = (rep.score / 100) * WEIGHTS.reputation;
    if (rep.confidence < 0.5) points = Math.min(points, LOW_CONFIDENCE_CAP);
    points *= 0.5 + 0.5 * rep.confidence;
    if (points > 1) {
      contributions.push({ label: `Reputação comunitária (${rep.reports} denúncias)`, points: Math.round(points) });
      score += points;
    }
  }

  if (inputs.campaign && inputs.campaign.risk >= 30) {
    const points = (inputs.campaign.risk / 100) * WEIGHTS.campaign;
    contributions.push({
      label: `Campanha de chamadas detectada (${inputs.campaign.similarCount} números similares)`,
      points: Math.round(points),
    });
    score += points;
  }

  const pattern = brazilPatternRisk(inputs.phone);
  if (pattern) {
    const points = (pattern.risk / 100) * WEIGHTS.pattern;
    contributions.push({ label: pattern.label, points: Math.round(points) });
    score += points;
  }

  if (inputs.stirShaken === 'PASS') {
    contributions.push({ label: 'STIR/SHAKEN: chamada assinada (menor chance de spoofing)', points: WEIGHTS.stirPass });
    score += WEIGHTS.stirPass;
  } else if (inputs.stirShaken === 'FAIL') {
    contributions.push({ label: 'STIR/SHAKEN: falha de verificação', points: WEIGHTS.stirFail });
    score += WEIGHTS.stirFail;
  }

  if (inputs.previouslyBlocked) {
    contributions.push({ label: 'Você já bloqueou este número antes', points: WEIGHTS.previouslyBlocked });
    score += WEIGHTS.previouslyBlocked;
  }
  if (inputs.previouslyAllowed) {
    contributions.push({ label: 'Número marcado como confiável por você', points: WEIGHTS.previouslyAllowed });
    score += WEIGHTS.previouslyAllowed;
  }

  // Guard-rail: reputação extremamente forte com confiança alta pode senturar.
  if (rep && rep.reports >= 20 && rep.confidence >= 0.7 && rep.score >= 85) score = Math.max(score, 90);

  const final = Math.max(0, Math.min(100, Math.round(score)));

  // Confiança: quantos sinais independentes concordam.
  const signals = contributions.length + (inputs.stirShaken !== 'UNKNOWN' && inputs.stirShaken !== undefined ? 1 : 0);
  const confidence = final >= 70 && signals >= 2 ? 'HIGH' : final >= 35 || signals >= 2 ? 'MEDIUM' : 'LOW';

  return { score: final, confidence, contributions };
}

export const RISK_BANDS = [
  { max: 20, label: 'Seguro' },
  { max: 40, label: 'Baixo risco' },
  { max: 60, label: 'Suspeito' },
  { max: 80, label: 'Provável spam' },
  { max: 100, label: 'Spam confirmado' },
] as const;

export function riskBand(score: number): string {
  return RISK_BANDS.find((b) => score <= b.max)?.label ?? 'Indefinido';
}
