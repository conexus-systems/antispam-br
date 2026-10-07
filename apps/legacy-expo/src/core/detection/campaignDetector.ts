/**
 * CampaignDetector (M9) — dezenas de números similares ligando em pouco tempo.
 * Similaridade: prefixo canônico comum (ex.: +55114002) numa janela temporal.
 * 100% local; nunca envia números.
 */
export interface CampaignSignal {
  /** Número canônico. */
  number: string;
  at: Date | string;
}

export interface CampaignResult {
  /** 0–100 */
  risk: number;
  similarCount: number;
  prefix?: string;
  label?: string;
}

/** Tamanho do prefixo de similaridade (chars do canônico). */
const PREFIX_LEN = 9; // ex.: '+55114002'
const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
/** Similaridade relevante a partir de N números distintos na janela. */
const MIN_CLUSTER = 3;

const toTime = (d: Date | string) => new Date(d).getTime();

export function detectCampaign(
  incoming: CampaignSignal,
  recent: CampaignSignal[],
  now: Date = new Date(),
): CampaignResult {
  const t0 = toTime(incoming.at ?? now);
  const window = recent.filter((r) => {
    const dt = t0 - toTime(r.at);
    return dt >= 0 && dt <= WINDOW_MS && r.number !== incoming.number;
  });

  if (window.length === 0) return { risk: 0, similarCount: 0 };

  const clusters = new Map<string, number>();
  for (const r of window) {
    if (r.number.length < PREFIX_LEN) continue;
    const p = r.number.slice(0, PREFIX_LEN);
    clusters.set(p, (clusters.get(p) ?? 0) + 1);
  }

  const incPrefix = incoming.number.slice(0, PREFIX_LEN);
  const similarCount = clusters.get(incPrefix) ?? 0;

  // Também considera clusters vizinhos (mesma empresa, faixa +1)
  let neighborhood = 0;
  for (const [p, count] of clusters) {
    if (p !== incPrefix && p.slice(0, 7) === incPrefix.slice(0, 7)) neighborhood += count;
  }

  const total = similarCount + neighborhood;
  if (total < MIN_CLUSTER) return { risk: 0, similarCount: total };

  // Risco cresce com a quantidade e satura em ~10 números
  const risk = Math.min(100, Math.round(35 + (total - MIN_CLUSTER) * 10));

  return {
    risk,
    similarCount: total,
    prefix: incPrefix,
    label: `${total} números similares (${incPrefix}…) ligaram nos últimos 10 min`,
  };
}
