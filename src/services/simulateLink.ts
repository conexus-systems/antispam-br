/**
 * Helpers puros da rota de simulação (testáveis sem React Native).
 */
export function parseSimulateParams(params: { number?: string }): string | null {
  const raw = params.number?.trim();
  return raw ? raw : null;
}
