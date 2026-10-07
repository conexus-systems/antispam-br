/**
 * ANTI-ABUSE / ANTI-POISONING — M8 (server-side, complementa reputation.ts).
 *
 * Defesas (missão §ANTI-POISONING):
 * - Reporter reputation: peso do denunciante cresce com histórico fiel, cai com contestações.
 * - Outlier detection: reporter que só denuncia números que ninguém mais denuncia perde peso.
 * - Quarantine: denúncias de reporters em quarentena não afetam score até moderação.
 * - Replay: timestamp no futuro ou muito antigo é rejeitado.
 */

import type { CommunityReport } from './reputation';

export interface ReporterStats {
  /** Total de denúncias já enviadas. */
  total: number;
  /** Quantas viraram consenso (confirmadas pela comunidade). */
  confirmed: number;
  /** Quantas foram contestadas (falso positivo). */
  contested: number;
  /** Em quarentena até revisão. */
  quarantined: boolean;
}

/** Peso do reporter: 0,25 (novo) → 1,5 (histórico fiel); 0 se quarentenado. */
export function reporterWeight(stats: ReporterStats): number {
  if (stats.quarantined) return 0;
  if (stats.total === 0) return 0.25;
  const accuracy = stats.confirmed / stats.total;
  const penalty = Math.min(0.6, (stats.contested / stats.total) * 0.8);
  const base = 0.25 + Math.min(1, accuracy * 1.25);
  return Math.max(0.05, base - penalty);
}

/** Detecta reporters outliers: ≥ N denúncias em que ele foi o único a denunciar o número. */
export function outlierReporters(
  history: CommunityReport[],
  minLoneReports = 5,
): Set<string> {
  // número → set de reporters
  const byNumber = new Map<string, Set<string>>();
  for (const r of history) {
    if (!byNumber.has(r.numberHash)) byNumber.set(r.numberHash, new Set());
    byNumber.get(r.numberHash)!.add(r.reporterHash);
  }

  // reporter → quantas vezes foi o único
  const loneCount = new Map<string, number>();
  for (const [, reporters] of byNumber) {
    if (reporters.size === 1) {
      const only = [...reporters][0];
      loneCount.set(only, (loneCount.get(only) ?? 0) + 1);
    }
  }

  const out = new Set<string>();
  for (const [reporter, count] of loneCount) {
    if (count >= minLoneReports) out.add(reporter);
  }
  return out;
}

export type RejectReason = 'FUTURE_TIMESTAMP' | 'TOO_OLD' | 'QUARANTINED' | 'DUPLICATE';

const MAX_AGE_DAYS = 7;

/** Validação de denúncia individual (replay/duplicidade/quarentena). */
export function validateReport(
  report: CommunityReport,
  seenKeys: Set<string>, // numberHash+reporterHash+minute já vistos
  quarantined: ReadonlySet<string>,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: RejectReason } {
  const driftMs = report.at.getTime() - now.getTime();
  if (driftMs > 5 * 60_000) return { ok: false, reason: 'FUTURE_TIMESTAMP' };
  if (driftMs < -MAX_AGE_DAYS * 86_400_000) return { ok: false, reason: 'TOO_OLD' };
  if (quarantined.has(report.reporterHash)) return { ok: false, reason: 'QUARANTINED' };

  const minuteKey = `${report.numberHash}:${report.reporterHash}:${Math.floor(report.at.getTime() / 60_000)}`;
  if (seenKeys.has(minuteKey)) return { ok: false, reason: 'DUPLICATE' };
  seenKeys.add(minuteKey);

  return { ok: true };
}

/**
 * Pipeline de aceitação: valida cada denúncia e devolve (aceitas, rejeitadas, pesos).
 * Peso do reporter multiplica a contribuição da denúncia no reputation engine.
 * `seen` externo permite dedup persistente entre requests (store do servidor).
 */
export function acceptReports(
  incoming: CommunityReport[],
  reporterStats: Map<string, ReporterStats>,
  now: Date = new Date(),
  seen?: Set<string>,
): {
  accepted: Array<{ report: CommunityReport; weight: number }>;
  rejected: Array<{ report: CommunityReport; reason: RejectReason }>;
} {
  const seenKeys = seen ?? new Set<string>();
  const quarantined = new Set(
    [...reporterStats.entries()].filter(([, s]) => s.quarantined).map(([h]) => h),
  );
  const outliers = outlierReporters(incoming);

  const accepted: Array<{ report: CommunityReport; weight: number }> = [];
  const rejected: Array<{ report: CommunityReport; reason: RejectReason }> = [];

  for (const report of incoming) {
    const v = validateReport(report, seenKeys, quarantined, now);
    if (!v.ok) {
      rejected.push({ report, reason: v.reason });
      continue;
    }
    const stats = reporterStats.get(report.reporterHash) ?? { total: 0, confirmed: 0, contested: 0, quarantined: false };
    let weight = reporterWeight(stats);
    if (outliers.has(report.reporterHash)) weight *= 0.5; // outlier: peso reduzido, não zero (evita FP contra usuário solitário real)
    accepted.push({ report, weight });
  }

  return { accepted, rejected };
}
