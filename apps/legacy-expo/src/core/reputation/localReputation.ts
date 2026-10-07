/**
 * Reputação local (M5/M8) — banco aberto no aparelho.
 * ANTI-ABUSE: uma denúncia isolada não decide nada; score depende de
 * denunciantes únicos, recência, confiança histórica e penalidade por falso-positivos.
 *
 * reputationScore = base(categoria) × saturação(uniqueReporters)
 *                   × recência − falsePositives, limitado a 0–100.
 */
import type { ReportCategory, ReputationEntry } from '../types';

/** Pesos por categoria — fraude/golpe pesam mais que pesquisa. */
export const CATEGORY_WEIGHTS: Record<ReportCategory, number> = {
  fraude: 20,
  golpe: 20,
  spam: 12,
  telemarketing: 12,
  robocall: 12,
  cobranca: 10,
  banco: 8,
  operadora: 8,
  entrega: 6,
  pesquisa: 4,
  outro: 5,
};

/** Cada denúncia vale menos que a anterior (saturação logarítmica; 50 relatos ≈ patamar). */
function reportSaturation(reports: number): number {
  return Math.min(1, Math.log2(1 + Math.max(0, reports)) / Math.log2(51));
}

/** Denunciantes únicos importam mais que volume de um único aparelho. */
function uniqueReporterFactor(uniqueReporters: number, reports: number): number {
  if (reports <= 0) return 0;
  const diversity = Math.min(1, uniqueReporters / reports);
  const minDiversity = Math.min(1, uniqueReporters / 2); // 1 denunciante isolado ≈ fator 0.5
  return 0.5 * diversity + 0.5 * minDiversity;
}

/** Recência: denúncias velhas valem menos (meia-vida ~180 dias). */
function recencyFactor(lastSeen: string, now: Date): number {
  const days = (now.getTime() - new Date(lastSeen).getTime()) / 86_400_000;
  return Math.pow(0.5, Math.max(0, days) / 180);
}

export interface ReportInput {
  category: ReportCategory;
  /** ID local anônimo do dispositivo (não é identidade real). */
  reporterId: string;
  at?: Date;
}

export function applyReport(entry: ReputationEntry | null, report: ReportInput): ReputationEntry {
  const now = report.at ?? new Date();
  const base: ReputationEntry = entry ?? {
    key: '',
    country: 'BR',
    category: report.category,
    score: 0,
    reports: 0,
    uniqueReporters: 0,
    firstSeen: now.toISOString(),
    lastSeen: now.toISOString(),
    confidence: 0,
    falsePositives: 0,
  };

  const reporters = new Set(base.reporterIds ?? []);
  reporters.add(report.reporterId);
  const uniqueReporters = Math.max(base.uniqueReporters, reporters.size);

  const updated: ReputationEntry = {
    ...base,
    reports: base.reports + 1,
    uniqueReporters,
    lastSeen: now.toISOString(),
    category: report.category,
    reporterIds: [...reporters].slice(-50), // teto local
  };

  updated.score = recomputeScore(updated, now);
  return updated;
}

export function applyFalsePositive(entry: ReputationEntry): ReputationEntry {
  const updated: ReputationEntry = {
    ...entry,
    falsePositives: entry.falsePositives + 1,
    score: Math.max(0, entry.score - 15),
  };
  updated.confidence = recomputeConfidence(updated);
  return updated;
}

export function recomputeScore(entry: ReputationEntry, now: Date = new Date()): number {
  if (entry.reports <= 0) return 0;
  const weight = CATEGORY_WEIGHTS[entry.category] ?? 5;
  let score =
    weight *
    (1 + reportSaturation(entry.reports) * 9) *
    uniqueReporterFactor(entry.uniqueReporters, entry.reports) *
    recencyFactor(entry.lastSeen, now);

  // Falsos positivos reduzem (cada um tira 12% acumulado)
  score *= Math.pow(0.88, entry.falsePositives);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function recomputeConfidence(entry: ReputationEntry): number {
  // Confiança cresce com denunciantes únicos e cai com falsos positivos.
  const u = Math.min(1, entry.uniqueReporters / 5);
  const fp = Math.pow(0.8, entry.falsePositives);
  const volume = Math.min(1, entry.reports / 10);
  return Math.round(Math.max(0, Math.min(1, (0.5 * u + 0.5 * volume) * fp)) * 100) / 100;
}

export function normalizeEntry(entry: ReputationEntry): ReputationEntry {
  return { ...entry, confidence: entry.confidence ?? recomputeConfidence(entry) };
}
