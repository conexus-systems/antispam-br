/**
 * Seed inicial da base (exemplos ilustrativos do formato aberto — SEM dados reais de terceiros).
 * Números 55114002/4003 são faixas corporativas usadas como exemplo estrutural.
 * A base real cresce por: denúncias locais + deltas comunitários assinados (§10-11).
 */
import type { ReputationEntry } from '../types';

export function seedDatabase(): ReputationEntry[] {
  const now = new Date().toISOString();
  const mk = (
    key: string,
    category: ReputationEntry['category'],
    score: number,
    reports: number,
    uniqueReporters: number,
  ): ReputationEntry => ({
    key,
    country: 'BR',
    category,
    score,
    reports,
    uniqueReporters,
    firstSeen: now,
    lastSeen: now,
    confidence: Math.min(1, uniqueReporters / 5),
    falsePositives: 0,
  });

  return [
    mk('+551140028922', 'telemarketing', 90, 142, 96),
    mk('+551140038700', 'telemarketing', 74, 89, 61),
    mk('+5511987654321', 'golpe', 92, 301, 214),
    mk('+5521976543210', 'fraude', 90, 178, 132),
    mk('+5531987651234', 'spam', 68, 34, 27),
    mk('+5511912345678', 'robocall', 71, 57, 44),
  ];
}
