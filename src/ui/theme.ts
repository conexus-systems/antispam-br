/**
 * Design system — identidade visual original AntiSpam BR (UX-AGENT).
 * Verde = proteção/seguro; Vermelho = bloqueio; Âmbar = suspeito.
 */
export const theme = {
  bg: '#0B1220',
  card: '#131C2E',
  cardAlt: '#1A2540',
  border: '#243352',
  text: '#EAF0FA',
  textDim: '#8FA3C4',
  primary: '#22C55E',
  primaryDim: '#166534',
  danger: '#EF4444',
  dangerDim: '#7F1D1D',
  warn: '#F59E0B',
  info: '#38BDF8',
  mute: '#64748B',
  radius: 16,
  space: (n: number) => n * 8,
} as const;

export function scoreColor(score: number): string {
  if (score >= 81) return theme.danger;
  if (score >= 61) return '#F97316';
  if (score >= 41) return theme.warn;
  if (score >= 21) return '#EAB308';
  return theme.primary;
}

export function actionColor(action: string): string {
  switch (action) {
    case 'BLOCK': return theme.danger;
    case 'SILENCE': return theme.mute;
    case 'WARN': return theme.warn;
    default: return theme.primary;
  }
}

export function actionLabel(action: string): string {
  switch (action) {
    case 'BLOCK': return 'Bloqueada';
    case 'SILENCE': return 'Silenciada';
    case 'WARN': return 'Suspeita';
    case 'ALLOW': return 'Permitida';
    default: return action;
  }
}
