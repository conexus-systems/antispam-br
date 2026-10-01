import { normalizePhone, formatDisplay } from '../src/core/phone/normalize';

describe('normalização brasileira', () => {
  test('celular com +55 e 9º dígito', () => {
    const n = normalizePhone('+5511999999999');
    expect(n.canonical).toBe('+5511999999999');
    expect(n.kind).toBe('mobile');
    expect(n.ddd).toBe('11');
    expect(n.isBrazilian).toBe(true);
  });

  test('celular sem +55 (11 dígitos nacionais)', () => {
    const n = normalizePhone('11987654321');
    expect(n.canonical).toBe('+5511987654321');
    expect(n.kind).toBe('mobile');
  });

  test('celular formatado com símbolos', () => {
    const n = normalizePhone('(21) 98765-4321');
    expect(n.canonical).toBe('+5521987654321');
  });

  test('fixo de 8 dígitos com DDD', () => {
    const n = normalizePhone('1130614000');
    expect(n.canonical).toBe('+551130614000');
    expect(n.kind).toBe('landline');
  });

  test('prefixo de operadora 015 + número', () => {
    const n = normalizePhone('01511999999999');
    expect(n.canonical).toBe('+5511999999999');
    expect(n.kind).toBe('mobile');
  });

  test('0800', () => {
    const n = normalizePhone('08001234567');
    expect(n.canonical).toBe('08001234567');
    expect(n.kind).toBe('tollFree');
  });

  test('0303 (telemarketing)', () => {
    const n = normalizePhone('03033130303');
    expect(n.kind).toBe('premium');
    expect(n.canonical).toBe('03033130303');
  });

  test('serviço 4004 sem DDD', () => {
    const n = normalizePhone('40048922');
    expect(n.kind).toBe('service');
    expect(n.canonical).toBe('40048922');
  });

  test('emergências nunca são normalizadas para +55', () => {
    for (const e of ['190', '192', '193', '100', '180']) {
      const n = normalizePhone(e);
      expect(n.kind).toBe('emergency');
      expect(n.canonical).toBe(e);
    }
  });

  test('número oculto', () => {
    expect(normalizePhone('').kind).toBe('hidden');
    expect(normalizePhone('   ').kind).toBe('hidden');
  });

  test('internacional não-Brasil', () => {
    const n = normalizePhone('+14155552671');
    expect(n.kind).toBe('international');
    expect(n.canonical).toBe('+14155552671');
    expect(n.isBrazilian).toBe(false);
  });

  test('formatDisplay celular', () => {
    expect(formatDisplay('+5511999999999')).toBe('(11) 99999-9999');
  });

  test('consistência: formas diferentes → mesmo canônico', () => {
    const a = normalizePhone('(11) 99999-9999');
    const b = normalizePhone('11999999999');
    const c = normalizePhone('+5511999999999');
    expect(a.canonical).toBe(b.canonical);
    expect(b.canonical).toBe(c.canonical);
  });
});
