/**
 * Regras especiais do Brasil (BRAZIL-TELECOM-AGENT).
 * Risco estrutural do número, independente de reputação — combinado no SpamScore.
 */
import type { NormalizedPhone } from '../types';

export interface PatternRisk {
  risk: number; // 0–100
  label: string;
}

/**
 * Risco por estrutura do número (heurística auditável — nada de IA caixa-preta aqui).
 * Valores conservadores: 0800 é usado por empresas legítimas; 0303 é rota
 * preferida de telemarketing desde a regulamentação de origem.
 */
export function brazilPatternRisk(n: NormalizedPhone): PatternRisk | null {
  switch (n.kind) {
    case 'premium':
      return { risk: 85, label: 'Número de valor agregado (0303/0900/0500), comum em telemarketing' };
    case 'tollFree':
      return { risk: 20, label: 'Número 0800 (empresas, mas também usado em golpes)' };
    case 'service':
      return { risk: 35, label: 'Central corporativa (4004/3003)' };
    case 'shortCode':
      return { risk: 30, label: 'Número curto/serviço' };
    case 'international':
      return { risk: 40, label: 'Chamada internacional' };
    case 'mobile':
      // Sequências repetidas: 1199999XXXX / 11999999999 completos repetidos
      if (/(\d)\1{4,}/.test(n.digits)) {
        return { risk: 45, label: 'Padrão de dígitos repetidos (número provavelmente sintético/spoofed)' };
      }
      return null;
    default:
      return null;
  }
}

export type Handle0303 = 'allow' | 'identify' | 'silence' | 'block';

export const HANDLE_0303_LABELS: Record<Handle0303, string> = {
  allow: 'Permitir',
  identify: 'Apenas identificar',
  silence: 'Silenciar',
  block: 'Bloquear',
};

/** O número é uma chamada 0303? */
export function is0303(n: NormalizedPhone): boolean {
  return n.kind === 'premium' && n.digits.startsWith('0303');
}
