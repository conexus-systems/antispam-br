/**
 * Reputação comunitária de números (ADR 0006). Função pura e determinística: o mesmo conjunto de
 * denúncias produz sempre o mesmo score, e o breakdown explica cada fator.
 * Contrato: data/test-vectors/reputation.json.
 */

export const CATEGORIES = [
  'OTHER', 'TELEMARKETING', 'ROBOCALL', 'SILENT_CALL', 'COLLECTION', 'BANK_SCAM', 'PIX_SCAM',
  'PHISHING', 'DELIVERY_SCAM', 'FAKE_SUPPORT', 'LOAN', 'SURVEY', 'SPOOFING', 'LEGITIMATE',
] as const;
export type Category = (typeof CATEGORIES)[number];
export type Label = 'CLEAN' | 'LOW_RISK' | 'SUSPICIOUS' | 'SPAM' | 'HIGH_RISK';

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

export interface ReputationConfig {
  halfLifeDays: number;
  /** Σw (já decaído) abaixo disso = evidência insuficiente; número fica neutro. */
  minWeightedReporters: number;
  /** Σw líquido que leva o score a ~63 % da gravidade (curva 1 - e^(-x/s)). */
  saturation: number;
  contestFactor: number;
  burstWindowHours: number;
  burstShare: number;
  youngReporterDays: number;
  /** Teto de peso somado por rede (/24, /48): muitos dispositivos numa rede valem como poucos. */
  networkCap: number;
  /** Contestações de dispositivos mais novos que isso só somam até o peso das mais antigas. */
  contestAnchorDays: number;
  labels: ReadonlyArray<{ label: Label; min: number }>;
  severity: Readonly<Record<Category, number>>;
  publication: {
    minWeightedReporters: number;
    minAgeHours: number;
    minScore: number;
    /** Fração mínima do peso vinda de dispositivos com ≥ youngReporterDays. */
    minMatureShare: number;
    /** Redes distintas mínimas entre os denunciantes com peso. */
    minNetworks: number;
  };
}

export const DEFAULT_CONFIG: ReputationConfig = {
  halfLifeDays: 30,
  minWeightedReporters: 2,
  saturation: 3,
  contestFactor: 1,
  burstWindowHours: 1,
  burstShare: 0.7,
  youngReporterDays: 7,
  networkCap: 1,
  contestAnchorDays: 30,
  labels: [
    { label: 'CLEAN', min: 0 },
    { label: 'LOW_RISK', min: 20 },
    { label: 'SUSPICIOUS', min: 40 },
    { label: 'SPAM', min: 60 },
    { label: 'HIGH_RISK', min: 80 },
  ],
  severity: {
    OTHER: 0.7, TELEMARKETING: 0.8, ROBOCALL: 0.85, SILENT_CALL: 0.8, COLLECTION: 0.75,
    BANK_SCAM: 1, PIX_SCAM: 1, PHISHING: 1, DELIVERY_SCAM: 1, FAKE_SUPPORT: 1, LOAN: 0.85,
    SURVEY: 0.6, SPOOFING: 0.95, LEGITIMATE: 0,
  },
  publication: { minWeightedReporters: 3, minAgeHours: 48, minScore: 60, minMatureShare: 0.5, minNetworks: 3 },
};

export interface ReporterStats {
  ageDays: number;
  /** Denúncias que coincidiram com o consenso final / que foram derrubadas. */
  agreements: number;
  disagreements: number;
  quarantined: boolean;
  /** Volume do dia acima do p99 da frota (ADR 0006 §7). */
  outlierToday?: boolean;
}

/** Peso do denunciante em [0, 1]: novo = 0,3; maduro e confiável → 1; quarentena/outlier = 0. */
export function reporterWeight(s: ReporterStats): number {
  if (s.quarantined || s.outlierToday) return 0;
  const maturity = Math.min(1, Math.max(0, s.ageDays) / 60);
  const accuracy = (s.agreements + 1) / (s.agreements + s.disagreements + 2);
  const base = 0.3 + 0.4 * maturity + 0.3 * Math.max(0, 2 * accuracy - 1);
  return round3(Math.min(1, base * Math.min(1, 2 * accuracy)));
}

export interface ReportInput {
  reporter: string;
  category: Category;
  /** epoch ms */
  at: number;
  weight: number;
  reporterAgeDays: number;
  /** Rede de origem do dispositivo (HMAC do prefixo). Ausente = rede própria do denunciante. */
  network?: string;
}

export interface NumberContext {
  neverBlock?: boolean;
  verifiedOrg?: boolean;
  /** Contestação qualificada (peso suficiente) aguardando moderação: suspende a publicação. */
  pendingContest?: boolean;
  /** Moderação aceitou a contestação: número sai da base. */
  contestAccepted?: boolean;
}

export interface Factor {
  factor: string;
  value: number;
  note: string;
}

export interface Reputation {
  score: number;
  label: Label;
  category: Category | null;
  weightedReporters: number;
  contestWeight: number;
  distinctReporters: number;
  insufficientEvidence: boolean;
  burstQuarantine: boolean;
  disputed: boolean;
  verifiedOrg: boolean;
  firstReportAt: number | null;
  lastReportAt: number | null;
  publishable: boolean;
  /** Motivos de não publicação (vazio quando publicável). */
  blockedBy: string[];
  factors: Factor[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export function labelFor(score: number, config: ReputationConfig = DEFAULT_CONFIG): Label {
  let label: Label = 'CLEAN';
  for (const l of config.labels) if (score >= l.min) label = l.label;
  return label;
}

/** Divide o peso de quem compartilha rede para que a soma por rede não passe do teto. */
function capByNetwork(reports: ReportInput[], cap: number): ReportInput[] {
  const totals = new Map<string, number>();
  const key = (r: ReportInput) => r.network ?? `r:${r.reporter}`;
  for (const r of reports) totals.set(key(r), (totals.get(key(r)) ?? 0) + r.weight);
  return reports.map((r) => {
    const total = totals.get(key(r)) ?? 0;
    return total > cap ? { ...r, weight: r.weight * (cap / total) } : r;
  });
}

/** Maior peso de denunciantes novos concentrado numa janela deslizante (ADR 0006 §6). */
function burstWeight(reports: ReportInput[], config: ReputationConfig): number {
  const young = reports
    .filter((r) => r.reporterAgeDays < config.youngReporterDays)
    .sort((a, b) => a.at - b.at);
  const window = config.burstWindowHours * HOUR;
  let best = 0;
  let sum = 0;
  let start = 0;
  for (let end = 0; end < young.length; end++) {
    sum += young[end].weight;
    while (young[end].at - young[start].at > window) sum -= young[start++].weight;
    best = Math.max(best, sum);
  }
  return best;
}

export function computeReputation(
  input: ReportInput[],
  now: number,
  ctx: NumberContext = {},
  config: ReputationConfig = DEFAULT_CONFIG,
): Reputation {
  // Um denunciante conta uma vez; vale a opinião mais recente dele.
  const latest = new Map<string, ReportInput>();
  for (const r of input) {
    if (r.at > now) continue;
    const prev = latest.get(r.reporter);
    if (!prev || r.at > prev.at) latest.set(r.reporter, r);
  }
  const reports = [...latest.values()];
  const abuse = capByNetwork(reports.filter((r) => r.category !== 'LEGITIMATE'), config.networkCap);
  const legit = capByNetwork(reports.filter((r) => r.category === 'LEGITIMATE'), config.networkCap);

  const decay = (r: ReportInput) => Math.pow(0.5, (now - r.at) / DAY / config.halfLifeDays);
  const spamWeight = abuse.reduce((s, r) => s + r.weight * decay(r), 0);
  // Contestação de dispositivo novo só soma até o peso das contestações maduras: Sybil de contas
  // novas não "limpa" número sozinho (vai para a moderação, que decide).
  const legitBy = (young: boolean) => legit
    .filter((r) => (r.reporterAgeDays < config.contestAnchorDays) === young)
    .reduce((s, r) => s + r.weight * decay(r), 0);
  const matureContest = legitBy(false);
  const contestWeight = matureContest + Math.min(legitBy(true), matureContest);

  const byCategory = new Map<Category, number>();
  for (const r of abuse) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.weight * decay(r));
  let category: Category | null = null;
  let best = 0;
  for (const c of CATEGORIES) {
    const w = byCategory.get(c) ?? 0;
    if (w > best) { best = w; category = c; }
  }
  const severity = spamWeight > 0
    ? [...byCategory].reduce((s, [c, w]) => s + config.severity[c] * w, 0) / spamWeight
    : 0;

  const net = spamWeight - config.contestFactor * contestWeight;
  const insufficientEvidence = spamWeight < config.minWeightedReporters;
  let score = 0;
  if (!ctx.contestAccepted && !insufficientEvidence && net > 0) {
    score = Math.round(100 * (1 - Math.exp(-net / config.saturation)) * severity);
  }
  score = Math.min(100, Math.max(0, score));

  const rawAbuse = abuse.reduce((s, r) => s + r.weight, 0);
  const burstQuarantine = rawAbuse > 0 && burstWeight(abuse, config) / rawAbuse > config.burstShare &&
    rawAbuse >= config.minWeightedReporters;

  const ats = abuse.map((r) => r.at);
  const firstReportAt = ats.length ? Math.min(...ats) : null;
  const lastReportAt = ats.length ? Math.max(...ats) : null;
  const disputed = Boolean(ctx.pendingContest) || contestWeight >= 1;

  const matureWeight = abuse
    .filter((r) => r.reporterAgeDays >= config.youngReporterDays)
    .reduce((s, r) => s + r.weight * decay(r), 0);
  const networks = new Set(abuse.filter((r) => r.weight > 0).map((r) => r.network ?? `r:${r.reporter}`)).size;

  const pub = config.publication;
  const blockedBy: string[] = [];
  if (ctx.contestAccepted) blockedBy.push('CONTEST_ACCEPTED');
  if (ctx.neverBlock) blockedBy.push('NEVER_BLOCK');
  if (spamWeight < pub.minWeightedReporters) blockedBy.push('FEW_REPORTERS');
  if (firstReportAt === null || now - firstReportAt < pub.minAgeHours * HOUR) blockedBy.push('TOO_RECENT');
  if (score < pub.minScore) blockedBy.push('LOW_SCORE');
  if (spamWeight > 0 && matureWeight / spamWeight < pub.minMatureShare) blockedBy.push('YOUNG_REPORTERS');
  if (networks < pub.minNetworks) blockedBy.push('FEW_NETWORKS');
  if (burstQuarantine) blockedBy.push('BURST_QUARANTINE');
  if (ctx.pendingContest) blockedBy.push('PENDING_CONTEST');

  const factors: Factor[] = [
    { factor: 'weighted_reporters', value: round3(spamWeight), note: `${abuse.length} denunciantes distintos, ponderados por confiança e recência` },
    { factor: 'contest_weight', value: round3(contestWeight), note: `${legit.length} contestações "é legítimo"` },
    { factor: 'severity', value: round3(severity), note: category ? `gravidade média; predominante ${category}` : 'sem denúncias' },
    { factor: 'networks', value: networks, note: 'redes distintas entre os denunciantes (peso por rede limitado)' },
    { factor: 'half_life_days', value: config.halfLifeDays, note: 'denúncias perdem metade do peso a cada meia-vida' },
  ];
  if (insufficientEvidence) factors.push({ factor: 'insufficient_evidence', value: 1, note: 'poucos denunciantes confiáveis: número neutro' });
  if (burstQuarantine) factors.push({ factor: 'burst_quarantine', value: 1, note: 'surto de denúncias de dispositivos novos: aguarda moderação' });

  return {
    score,
    label: labelFor(score, config),
    category,
    weightedReporters: round3(spamWeight),
    contestWeight: round3(contestWeight),
    distinctReporters: abuse.length,
    insufficientEvidence,
    burstQuarantine,
    disputed,
    verifiedOrg: Boolean(ctx.verifiedOrg),
    firstReportAt,
    lastReportAt,
    publishable: blockedBy.length === 0,
    blockedBy,
    factors,
  };
}
