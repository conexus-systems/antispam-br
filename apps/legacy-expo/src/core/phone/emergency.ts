/**
 * Números de emergência e serviços críticos do Brasil.
 * REGRA ABSOLUTA: nunca bloquear, silenciar ou atrasar esses números (fail-safe humano).
 */
export const BR_EMERGENCY_NUMBERS: readonly string[] = [
  '190', // Polícia Militar
  '192', // SAMU
  '193', // Bombeiros
  '194', // Polícia Federal
  '195', // Polícia Rodoviária Federal
  '197', // Polícia Civil
  '198', // Polícia Militar (estadual)
  '199', // Defesa Civil
  '100', // Direitos Humanos
  '180', // Central de Atendimento à Mulher
  '181', // Disque-Denúncia
  '112', // Emergência (padrão GSM internacional)
  '911', // Emergência (padrão EUA, presente em GSM)
];

export function isEmergencyNumber(digits: string): boolean {
  return BR_EMERGENCY_NUMBERS.includes(digits);
}
