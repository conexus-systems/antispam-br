/**
 * REPUTATION ENGINE — server-side (M8).
 *
 * Score 0–100 a partir de denúncias comunitárias com anti-abuse embutido:
 * - Denúncia isolada NUNCA decide (min denunciantes distintos).
 * - Peso temporal (decaimento exponencial) — denúncias velhas valem menos.
 * - Contestações (LEGITIMATE) e falsos positivos penalizam o score.
 * - Velocidade anormal de denúncias (burst) é limitada (anti-mass-reporting).
 *
 * Determinístico e puro — testável sem banco.
 */

export interface CommunityReport {
  /** SHA-256 do número normalizado (privacidade: número cru nunca chega ao server). */
  numberHash: string;
  category: string;
  at: Date;
  /** Hash anônimo do denunciante (rotação diária no cliente). */
  reporterHash: string;
  confidence: number; // 0–1
  source: 'USER_REPORT' | 'USER_CONFIRMATION' | 'USER_CONTEST' | 'LOCAL_PATTERN' | 'PARTNER_FEED';
}

export interface ReputationThresholds {
  clean: number;      // < clean → CLEAN
  lowRisk: number;    // < lowRisk → LOW_RISK
  suspicious: number; // < suspicious → SUSPICIOUS
  spam: number;       // < spam → SPAM; >= spam → HIGH_RISK
}

/** Thresholds padrão (missão §REPUTATION — configuráveis). */
export const DEFAULT_THRESHOLDS: ReputationThresholds = {
  clean: 20,
  lowRisk: 40,
  suspicious: 60,
  spam: 80,
};

/** Anti-abuse: mínimo de denunciantes distintos para o número pontuar. */
export const MIN_DISTINCT_REPORTERS = 2;

/** Janela/half-life do decaimento temporal (dias). */
export const HALF_LIFE_DAYS = 14;

/** Burst: mais que N denúncias/hora do mesmo reporter = peso zero (bot). */
export const BURST_MAX_PER_HOUR = 3;

export type ReputationLabel = 'CLEAN' | 'LOW_RISK' | 'SUSPICIOUS' | 'SPAM' | 'HIGH_RISK';

export interface ReputationResult {
  score: number;
  label: ReputationLabel;
  totalReports: number;
  distinctReporters: number;
  /** Denúncias descartadas por anti-abuse. */
  discarded: number;
  breakdown: Array<{ label: string; points: number }>;
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  TELEMARKETING: 8,
  ROBOCALL: 12,
  SILENT_CALL: 12,
  COLLECTION: 10,
  BANK_SCAM: 22,
  PIX_SCAM: 22,
  PHISHING: 20,
  DELIVERY_SCAM: 16,
  FAKE_SUPPORT: 18,
  LOAN: 10,
  SURVEY: 6,
  SPOOFING: 15,
  LEGITIMATE: -18,
  OTHER: 6,
};

const SOURCE_MULTIPLIER: Record<CommunityReport['source'], number> = {
  USER_REPORT: 1,
  USER_CONFIRMATION: 1.25,
  USER_CONTEST: 1,
  LOCAL_PATTERN: 0.6,
  PARTNER_FEED: 0.8,
};

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/** Peso temporal: decai com half-life de HALF_LIFE_DAYS dias. */
export function temporalWeight(reportAt: Date, now: Date): number {
  return Math.pow(0.5, daysBetween(now, reportAt) / HALF_LIFE_DAYS);
}

/**
 * Rate por reporter: denúncias em burst (> BURST_MAX_PER_HOUR na mesma hora)
 * recebem peso zero — proteção contra bot reporting.
 */
export function reporterBurstFilter(reports: CommunityReport[]): Set<CommunityReport> {
  const byHour = new Map<string, number>();
  const discarded = new Set<CommunityReport>();
  const sorted = [...reports].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const r of sorted) {
    const hourKey = `${r.reporterHash}:${Math.floor(r.at.getTime() / 3_600_000)}`;
    const count = (byHour.get(hourKey) ?? 0) + 1;
    byHour.set(hourKey, count);
    if (count > BURST_MAX_PER_HOUR) discarded.add(r);
  }
  return discarded;
}

export function computeCommunityReputation(
  reports: CommunityReport[],
  now: Date = new Date(),
  thresholds: ReputationThresholds = DEFAULT_THRESHOLDS,
): ReputationResult {
  const breakdown: ReputationResult['breakdown'] = [];
  const burstDiscarded = reporterBurstFilter(reports);
  const valid = reports.filter((r) => !burstDiscarded.has(r));

  const distinctReporters = new Set(valid.map((r) => r.reporterHash)).size;

  // Anti-abuse central: sem volume mínimo de denunciantes, número fica neutro.
  if (valid.length === 0 || distinctReporters < MIN_DISTINCT_REPORTERS) {
    return {
      score: 0,
      label: 'CLEAN',
      totalReports: reports.length,
      distinctReporters,
      discarded: reports.length - valid.length,
      breakdown: [{ label: `Denunciantes distintos (${distinctReporters}) < mínimo ${MIN_DISTINCT_REPORTERS} — neutro por anti-abuse`, points: 0 }],
    };
  }

  let score = 0;

  // 1. Volume ponderado por recência + categoria + fonte + confiança
  let weightedVolume = 0;
  for (const r of valid) {
    const tw = temporalWeight(r.at, now);
    const cat = CATEGORY_WEIGHTS[r.category] ?? CATEGORY_WEIGHTS.OTHER;
    const src = SOURCE_MULTIPLIER[r.source] ?? 0.5;
    weightedVolume += cat * src * Math.max(0, Math.min(1, r.confidence)) * tw;
  }
  // Saturação logarítmica: 10 denúncias já contam muito; 1000 não 10x mais
  const volumePoints = Math.min(60, 60 * (1 - Math.exp(-weightedVolume / 50)));
  if (volumePoints > 1) {
    breakdown.push({ label: `Volume de denúncias (${valid.length}, ${distinctReporters} distintos)`, points: Math.round(volumePoints) });
    score += volumePoints;
  }

  // 1b. Credibilidade por denunciantes distintos (anti-Sybil já garantiu o mínimo)
  if (distinctReporters >= 3) {
    const credPoints = Math.min(12, distinctReporters * 2);
    breakdown.push({ label: `Credibilidade (${distinctReporters} denunciantes independentes)`, points: Math.round(credPoints) });
    score += credPoints;
  }

  // 2. Contestações recentes puxam para baixo
  const contests = valid.filter((r) => r.category === 'LEGITIMATE');
  if (contests.length) {
    const contestWeight = contests.reduce((acc, r) => acc + temporalWeight(r.at, now), 0);
    const contestPoints = -Math.min(45, 15 * contestWeight);
    breakdown.push({ label: `Contestações (${contests.length})`, points: Math.round(contestPoints) });
    score += contestPoints;
  }

  // 3. Velocidade anormal coletiva (muitas denúncias em janela curta = campanha/golpe ativo)
  const recent = valid.filter((r) => daysBetween(now, r.at) <= 2 && r.category !== 'LEGITIMATE');
  if (recent.length >= 5) {
    const burstPoints = Math.min(20, recent.length);
    breakdown.push({ label: `Rajada recente (${recent.length} em 48h)`, points: Math.round(burstPoints) });
    score += burstPoints;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const label: ReputationLabel =
    finalScore < thresholds.clean ? 'CLEAN'
    : finalScore < thresholds.lowRisk ? 'LOW_RISK'
    : finalScore < thresholds.suspicious ? 'SUSPICIOUS'
    : finalScore < thresholds.spam ? 'SPAM'
    : 'HIGH_RISK';

  return {
    score: finalScore,
    label,
    totalReports: reports.length,
    distinctReporters,
    discarded: reports.length - valid.length,
    breakdown,
  };
}
