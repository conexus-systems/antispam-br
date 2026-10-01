import { computeSpamScore, riskBand } from '../src/core/detection/spamScore';
import { normalizePhone } from '../src/core/phone/normalize';

describe('SpamScore', () => {
  test('sem sinais → score 0', () => {
    const r = computeSpamScore({ phone: normalizePhone('+551130614000') });
    expect(r.score).toBe(0);
    expect(r.confidence).toBe('LOW');
  });

  test('reputação forte + padrão 0303 → score alto com confiança', () => {
    const r = computeSpamScore({
      phone: normalizePhone('03033130303'),
      reputation: { score: 90, reports: 40, confidence: 0.8 },
    });
    expect(r.score).toBeGreaterThan(80);
    expect(r.contributions.length).toBeGreaterThanOrEqual(2);
  });

  test('reputação fraca (1 denúncia) quase não pontua', () => {
    const r = computeSpamScore({
      phone: normalizePhone('+5511999981234'),
      reputation: { score: 80, reports: 1, confidence: 0.2 },
    });
    expect(r.score).toBeLessThan(20);
  });

  test('STIR/SHAKEN PASS reduz score', () => {
    const withPass = computeSpamScore({
      phone: normalizePhone('03033130303'),
      stirShaken: 'PASS',
    });
    const without = computeSpamScore({ phone: normalizePhone('03033130303') });
    expect(withPass.score).toBeLessThan(without.score);
  });

  test('bloqueio anterior do usuário pesa', () => {
    const r = computeSpamScore({ phone: normalizePhone('+5511976543211'), previouslyBlocked: true });
    expect(r.score).toBeGreaterThanOrEqual(40);
  });

  test('score nunca ultrapassa 100', () => {
    const r = computeSpamScore({
      phone: normalizePhone('03033130303'),
      reputation: { score: 100, reports: 500, confidence: 1 },
      campaign: { risk: 100, similarCount: 12 },
      previouslyBlocked: true,
      stirShaken: 'FAIL',
    });
    expect(r.score).toBe(100);
  });

  test('bandas de risco (§5)', () => {
    expect(riskBand(10)).toBe('Seguro');
    expect(riskBand(30)).toBe('Baixo risco');
    expect(riskBand(50)).toBe('Suspeito');
    expect(riskBand(70)).toBe('Provável spam');
    expect(riskBand(95)).toBe('Spam confirmado');
  });
});
