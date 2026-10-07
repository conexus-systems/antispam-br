import { parseSimulateParams } from '../src/services/simulateLink';

describe('rota simulate (deep link)', () => {
  test('extrai o número do parâmetro', () => {
    expect(parseSimulateParams({ number: '+551140028922' })).toBe('+551140028922');
  });

  test('número ausente/vazio → null (mostra instruções)', () => {
    expect(parseSimulateParams({})).toBeNull();
    expect(parseSimulateParams({ number: '   ' })).toBeNull();
  });
});
