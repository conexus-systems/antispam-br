/**
 * SpamDecisionEngine (§23) — coração do app.
 *
 * Pipeline (§4):
 *   Normalize → Emergency → Contacts/Allowlist → User rules → Blacklist
 *   → Local reputation → Pattern → Campaign → STIR/SHAKEN → Score → Decision
 *
 * FAIL-SAFE (§24): qualquer erro interno → ALLOW, nunca bloquear por falha.
 */
import type {
  CallContext,
  CallDecision,
  NormalizedPhone,
  ProtectionMode,
  ReputationEntry,
  Rule,
} from '../types';
import { normalizePhone, formatDisplay } from '../phone/normalize';
import { evaluateRules, type RuleContext } from '../rules/rulesEngine';
import { computeSpamScore, riskBand, type ReputationSignal } from '../detection/spamScore';
import { detectCampaign, type CampaignSignal } from '../detection/campaignDetector';
import { is0303 } from '../phone/brazilRules';

export interface DecisionEngineConfig {
  mode: ProtectionMode;
  /** Limiar de score para BLOCK no modo atual (CUSTOM usa regras próprias). */
  blockThreshold: number;
  silenceThreshold: number;
  warnThreshold: number;
  /** Tratamento específico do 0303 (§8). */
  handle0303: 'allow' | 'identify' | 'silence' | 'block';
  /** Bloquear números fora dos contatos (modo AGGRESSIVE). */
  blockUnknownInAggressive: boolean;
}

export const MODE_DEFAULTS: Record<Exclude<ProtectionMode, 'CUSTOM'>, DecisionEngineConfig> = {
  OFF: { mode: 'OFF', blockThreshold: 101, silenceThreshold: 101, warnThreshold: 101, handle0303: 'allow', blockUnknownInAggressive: false },
  BASIC: { mode: 'BASIC', blockThreshold: 90, silenceThreshold: 95, warnThreshold: 70, handle0303: 'identify', blockUnknownInAggressive: false },
  BALANCED: { mode: 'BALANCED', blockThreshold: 75, silenceThreshold: 85, warnThreshold: 55, handle0303: 'silence', blockUnknownInAggressive: false },
  AGGRESSIVE: { mode: 'AGGRESSIVE', blockThreshold: 60, silenceThreshold: 70, warnThreshold: 40, handle0303: 'block', blockUnknownInAggressive: true },
};

export interface EngineInput {
  ctx: CallContext;
  config: DecisionEngineConfig;
  rules: Rule[];
  /** Whitelist explícita (canônico). */
  allowlist: string[];
  /** Blacklist explícita (canônico). */
  blacklist: string[];
  /** Consulta ao banco local de reputação. */
  lookupReputation: (canonical: string) => ReputationEntry | null;
  /** Números similares recebidos recentemente (histórico local). */
  recentCalls: CampaignSignal[];
  /** Conjunto de números canônicos dos contatos (resolvido localmente). */
  contactNumbers?: Set<string>;
  /** Canônicos que o usuário bloqueou antes. */
  previouslyBlocked?: Set<string>;
  /** Canônicos marcados confiáveis antes. */
  previouslyAllowed?: Set<string>;
}

function allowDecision(n: NormalizedPhone, reasons: CallDecision['reasons'], explanation: string[]): CallDecision {
  return { action: 'ALLOW', score: 0, confidence: 'HIGH', reasons, explanation, normalized: n };
}

function actionForScore(score: number, config: DecisionEngineConfig, confidence: CallDecision['confidence']): CallDecision['action'] {
  if (score >= config.blockThreshold) {
    // §35: BLOCK agressivo exige confiança elevada — score alto com confiança baixa vira SILENCE.
    if (confidence === 'LOW' && score < config.blockThreshold + 15) return 'SILENCE';
    return 'BLOCK';
  }
  if (score >= config.silenceThreshold) return 'SILENCE';
  if (score >= config.warnThreshold) return 'WARN';
  return 'ALLOW';
}

export function decide(input: EngineInput): CallDecision {
  const { ctx, config } = input;
  try {
    return decideUnsafe(input);
  } catch {
    // FAIL-SAFE: erro interno → permitir e registrar (quem chama loga o erro).
    const n = normalizePhone(ctx.rawNumber);
    return {
      action: 'ALLOW',
      score: 0,
      confidence: 'LOW',
      reasons: ['FAILSAFE'],
      explanation: ['Falha interna ao analisar a chamada — permitida por segurança (fail-safe).'],
      normalized: n,
    };
  }
}

function decideUnsafe(input: EngineInput): CallDecision {
  const { ctx, config } = input;
  const n = normalizePhone(ctx.rawNumber);
  const explanation: string[] = [];
  const reasons: CallDecision['reasons'] = [];

  // 0) Modo desativado
  if (config.mode === 'OFF') {
    return allowDecision(n, ['MODE_UNKNOWN'], ['Proteção desativada — chamada permitida.']);
  }

  // 1) Emergência — REGRA ABSOLUTA
  if (n.kind === 'emergency') {
    return allowDecision(n, ['EMERGENCY_NUMBER'], ['Número de emergência — nunca é bloqueado.']);
  }

  // 2) Contatos / whitelist
  const isContact =
    (ctx.contactName != null && ctx.contactName !== '') ||
    (input.contactNumbers?.has(n.canonical) ?? false);
  if (isContact) {
    return allowDecision(n, ['CONTACT'], [`Chamada de contato (${ctx.contactName ?? 'na agenda'}).`]);
  }
  if (input.allowlist.includes(n.canonical)) {
    return allowDecision(n, ['ALLOWLIST'], ['Número na sua lista de permitidos.']);
  }

  // 3) Blacklist explícita
  if (input.blacklist.includes(n.canonical)) {
    return {
      action: 'BLOCK',
      score: 100,
      confidence: 'HIGH',
      reasons: ['BLACKLIST'],
      explanation: ['Número na sua lista de bloqueados.'],
      normalized: n,
    };
  }

  // 4) Regras do usuário (primeira que casa vence)
  const ruleCtx: RuleContext = {
    isContact,
    at: ctx.at,
    presentation: ctx.presentation,
  };
  const ruleEval = evaluateRules(input.rules, n, ruleCtx);
  if (ruleEval.matched && ruleEval.action) {
    explanation.push(`Regra "${ruleEval.matched.name}" aplicada.`);
    if (ruleEval.action === 'ALLOW') return allowDecision(n, ['USER_RULE'], explanation);
    return {
      action: ruleEval.action,
      score: ruleEval.action === 'BLOCK' ? 95 : 70,
      confidence: 'HIGH',
      reasons: ['USER_RULE'],
      explanation,
      normalized: n,
    };
  }

  // 5) Tratamento específico 0303 (§8)
  if (is0303(n) && config.handle0303 !== 'allow' && config.handle0303 !== 'identify') {
    return {
      action: config.handle0303 === 'block' ? 'BLOCK' : 'SILENCE',
      score: 88,
      confidence: 'MEDIUM',
      reasons: ['BRAZIL_RULE'],
      explanation: ['Chamada 0303 (rota de telemarketing) — tratamento configurado por você.'],
      normalized: n,
    };
  }

  // 6) Score composto
  const rep = input.lookupReputation(n.canonical);
  const repSignal: ReputationSignal | null = rep
    ? { score: rep.score, reports: rep.reports, confidence: rep.confidence }
    : null;

  const campaign = detectCampaign({ number: n.canonical, at: ctx.at }, input.recentCalls, ctx.at);
  const previouslyBlocked = input.previouslyBlocked?.has(n.canonical) ?? false;
  const previouslyAllowed = input.previouslyAllowed?.has(n.canonical) ?? false;

  const breakdown = computeSpamScore({
    phone: n,
    reputation: repSignal,
    campaign: campaign.risk > 0 ? { risk: campaign.risk, similarCount: campaign.similarCount } : null,
    stirShaken: ctx.stirShaken,
    previouslyBlocked,
    previouslyAllowed,
  });

  explanation.push(...breakdown.contributions.map((c) => `${c.label} (+${c.points})`));

  // 7) Modo AGGRESSIVE: fora dos contatos com apresentação desconhecida
  if (config.blockUnknownInAggressive && !isContact && n.kind === 'international') {
    breakdown.score = Math.max(breakdown.score, config.blockThreshold);
    explanation.push('Modo agressivo: chamada internacional fora dos contatos.');
    breakdown.confidence = breakdown.score >= config.blockThreshold ? 'MEDIUM' : breakdown.confidence;
  }

  // 8) Decisão final
  const action = actionForScore(breakdown.score, config, breakdown.confidence);
  if (action === 'ALLOW' && breakdown.score >= config.warnThreshold / 2 && breakdown.contributions.length > 0) {
    reasons.push('PATTERN');
  }
  if (campaign.risk > 0) reasons.push('CAMPAIGN');
  if (repSignal) reasons.push('LOCAL_REPUTATION');
  if (ctx.stirShaken === 'FAIL') reasons.push('STIR_SHAKEN');
  if (action !== 'ALLOW' && reasons.length === 0) reasons.push('PATTERN');

  return {
    action,
    score: breakdown.score,
    confidence: breakdown.confidence,
    reasons,
    explanation:
      action === 'ALLOW' && breakdown.score === 0
        ? ['Nenhum sinal de risco encontrado.']
        : [`Score ${breakdown.score}/100 — ${riskBand(breakdown.score)}.`, ...explanation],
    normalized: n,
  };
}

export { formatDisplay };
