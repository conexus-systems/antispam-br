/**
 * Tipos centrais do domínio AntiSpam BR.
 * Mantidos puros (sem imports de RN) para alta testabilidade.
 */

export type ProtectionMode = 'OFF' | 'BASIC' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM';

export type CallAction = 'ALLOW' | 'WARN' | 'SILENCE' | 'BLOCK';

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

export type PhoneKind =
  | 'mobile'
  | 'landline'
  | 'service' // 4004/3003 (tarifa local corporativa)
  | 'tollFree' // 0800
  | 'premium' // 0303 / 0900 / 0500
  | 'shortCode'
  | 'emergency'
  | 'international'
  | 'unknown'
  | 'hidden';

/** Número normalizado de forma canônica para o Brasil. */
export interface NormalizedPhone {
  /** Número exatamente como o sistema informou. */
  raw: string;
  /** Forma canônica: '+5511999999999', '08001234567', '03033130303', '190', '+441234567890'. */
  canonical: string;
  /** Somente dígitos (sem '+'). */
  digits: string;
  countryPrefix?: string;
  ddd?: string;
  kind: PhoneKind;
  isBrazilian: boolean;
}

export type StirShaken = 'PASS' | 'FAIL' | 'UNKNOWN';

export type CallPresentation = 'ALLOWED' | 'PAYPHONE' | 'RESTRICTED' | 'UNKNOWN';

export interface CallContext {
  rawNumber: string;
  presentation?: CallPresentation;
  /** Resolvido LOCALMENTE a partir dos contatos do aparelho. Nunca sai do dispositivo. */
  contactName?: string | null;
  /** Sinal STIR/SHAKEN quando disponível (Android 10+). */
  stirShaken?: StirShaken;
  at: Date;
}

export type DecisionReason =
  | 'EMERGENCY_NUMBER'
  | 'CONTACT'
  | 'ALLOWLIST'
  | 'USER_RULE'
  | 'BLACKLIST'
  | 'LOCAL_REPUTATION'
  | 'PATTERN'
  | 'CAMPAIGN'
  | 'BRAZIL_RULE'
  | 'STIR_SHAKEN'
  | 'MODE_UNKNOWN'
  | 'FAILSAFE';

export interface CallDecision {
  action: CallAction;
  /** SpamScore 0–100. */
  score: number;
  confidence: Confidence;
  reasons: DecisionReason[];
  /** Explicação legível (pt-BR) — decisão sempre explicável. */
  explanation: string[];
  normalized: NormalizedPhone;
}

export type ReportCategory =
  | 'spam'
  | 'telemarketing'
  | 'fraude'
  | 'robocall'
  | 'cobranca'
  | 'pesquisa'
  | 'golpe'
  | 'banco'
  | 'operadora'
  | 'entrega'
  | 'outro';

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  spam: 'Spam',
  telemarketing: 'Telemarketing',
  fraude: 'Fraude',
  robocall: 'Robocall',
  cobranca: 'Cobrança',
  pesquisa: 'Pesquisa',
  golpe: 'Golpe financeiro',
  banco: 'Banco',
  operadora: 'Operadora',
  entrega: 'Entrega',
  outro: 'Outro',
};

export type RuleAction = CallAction;

export type RuleMatch =
  | { kind: 'number'; value: string }
  | { kind: 'prefix'; value: string }
  | { kind: 'ddd'; value: string }
  | { kind: 'regex'; pattern: string }
  | { kind: 'hidden' }
  | { kind: 'international' }
  | { kind: 'notContact' }
  | { kind: 'schedule'; start: string; end: string; weekdays?: number[] };

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  action: RuleAction;
  match: RuleMatch;
}

export interface HistoryEntry {
  id: string;
  /** Número canônico. */
  number: string;
  display: string;
  name?: string | null;
  /** ISO 8601. */
  at: string;
  action: CallAction;
  score: number;
  reasons: DecisionReason[];
  category?: ReportCategory | null;
  simulated?: boolean;
}

/** Registro do banco local de reputação (formato aberto — docs/ARCHITECTURE.md §11). */
export interface ReputationEntry {
  /** Chave local = número canônico. Na sincronização remota usa-se hash-prefix (privacy by design). */
  key: string;
  country: string;
  category: ReportCategory;
  score: number;
  reports: number;
  uniqueReporters: number;
  firstSeen: string;
  lastSeen: string;
  /** 0–1 */
  confidence: number;
  falsePositives: number;
  /** IDs locais anônimos dos denunciantes (teto 50, nunca sai do aparelho sem consentimento). */
  reporterIds?: string[];
}
