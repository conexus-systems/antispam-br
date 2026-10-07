/**
 * Motor de regras do usuário (M3/M4).
 * A primeira regra habilitada que casa vence (ordem de inserção, reordenável).
 * Whitelist/contatos são avaliados ANTES pelo DecisionEngine.
 */
import type { CallDecision, CallPresentation, NormalizedPhone, Rule, RuleAction } from '../types';

export interface RuleContext {
  isContact: boolean;
  at: Date;
  presentation?: CallPresentation;
}

function appliesToNumber(rule: Rule, n: NormalizedPhone, ctx: RuleContext): boolean {
  switch (rule.match.kind) {
    case 'number':
      return !!n.canonical && n.canonical === rule.match.value.replace(/\s+/g, '');
    case 'prefix':
      return !!n.canonical && n.canonical.startsWith(rule.match.value.replace(/\s+/g, ''));
    case 'ddd':
      return n.ddd === rule.match.value;
    case 'regex':
      try {
        return new RegExp(rule.match.pattern).test(n.canonical || n.raw);
      } catch {
        return false; // regex inválida nunca bloqueia
      }
    case 'hidden':
      return n.kind === 'hidden' || ctx.presentation === 'RESTRICTED' || ctx.presentation === 'PAYPHONE';
    case 'international':
      return n.kind === 'international';
    case 'notContact':
      return !ctx.isContact;
    case 'schedule': {
      const [sh, sm] = rule.match.start.split(':').map(Number);
      const [eh, em] = rule.match.end.split(':').map(Number);
      const mins = ctx.at.getHours() * 60 + ctx.at.getMinutes();
      const start = (sh || 0) * 60 + (sm || 0);
      const end = (eh || 0) * 60 + (em || 0);
      const inWindow = start <= end ? mins >= start && mins < end : mins >= start || mins < end;
      if (!inWindow) return false;
      if (rule.match.weekdays && rule.match.weekdays.length > 0) {
        return rule.match.weekdays.includes(ctx.at.getDay());
      }
      return true;
    }
    default:
      return false;
  }
}

export interface RuleEvaluation {
  matched: Rule | null;
  action: RuleAction | null;
}

export function evaluateRules(rules: Rule[], n: NormalizedPhone, ctx: RuleContext): RuleEvaluation {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (appliesToNumber(rule, n, ctx)) return { matched: rule, action: rule.action };
  }
  return { matched: null, action: null };
}

export function describeRule(rule: Rule): string {
  switch (rule.match.kind) {
    case 'number': return `Número ${rule.match.value}`;
    case 'prefix': return `Prefixo ${rule.match.value}`;
    case 'ddd': return `DDD ${rule.match.value}`;
    case 'regex': return `Padrão ${rule.match.pattern}`;
    case 'hidden': return 'Números ocultos/privados';
    case 'international': return 'Chamadas internacionais';
    case 'notContact': return 'Fora dos contatos';
    case 'schedule': return `Horário ${rule.match.start}–${rule.match.end}`;
  }
}
