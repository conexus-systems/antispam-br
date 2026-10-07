import { decide, MODE_DEFAULTS, type EngineInput } from '../src/core/decision/decisionEngine';
import type { CallContext, Rule } from '../src/core/types';

function ctx(raw: string, at = new Date('2026-06-01T15:00:00')): CallContext {
  return { rawNumber: raw, at, presentation: 'ALLOWED', contactName: null, stirShaken: 'UNKNOWN' };
}

function baseInput(over: Partial<EngineInput> = {}): EngineInput {
  return {
    ctx: ctx('+5511999999999'),
    config: MODE_DEFAULTS.BALANCED,
    rules: [],
    allowlist: [],
    blacklist: [],
    lookupReputation: () => null,
    recentCalls: [],
    ...over,
  };
}

describe('DecisionEngine — regras fundamentais', () => {
  test('emergência 190 NUNCA é bloqueada', () => {
    const d = decide(baseInput({ ctx: ctx('190'), config: MODE_DEFAULTS.AGGRESSIVE, blacklist: ['190'] }));
    expect(d.action).toBe('ALLOW');
    expect(d.reasons).toContain('EMERGENCY_NUMBER');
  });

  test('whitelist vence qualquer score', () => {
    const d = decide(baseInput({ allowlist: ['+5511999999999'] }));
    expect(d.action).toBe('ALLOW');
    expect(d.reasons).toContain('ALLOWLIST');
  });

  test('blacklist bloqueia com score 100', () => {
    const d = decide(baseInput({ blacklist: ['+5511999999999'] }));
    expect(d.action).toBe('BLOCK');
    expect(d.reasons).toContain('BLACKLIST');
  });

  test('modo OFF não bloqueia nada', () => {
    const d = decide(baseInput({ config: MODE_DEFAULTS.OFF, blacklist: ['+5511999999999'] }));
    expect(d.action).toBe('ALLOW');
  });

  test('modo BALANCED bloqueia reputação alta da base', () => {
    const d = decide(
      baseInput({
        ctx: ctx('+551140028922'),
        lookupReputation: (c) =>
          c === '+551140028922'
            ? { key: c, country: 'BR', category: 'telemarketing', score: 92, reports: 150, uniqueReporters: 120, firstSeen: '', lastSeen: new Date().toISOString(), confidence: 0.9, falsePositives: 0 }
            : null,
      }),
    );
    expect(['BLOCK', 'SILENCE']).toContain(d.action);
    expect(d.score).toBeGreaterThan(70);
    expect(d.explanation.join(' ')).toContain('Reputação');
  });

  test('uma denúncia isolada NÃO bloqueia', () => {
    const d = decide(
      baseInput({
        ctx: ctx('+5531999991234'),
        lookupReputation: (c) =>
          c === '+5531999991234'
            ? { key: c, country: 'BR', category: 'spam', score: 60, reports: 1, uniqueReporters: 1, firstSeen: '', lastSeen: new Date().toISOString(), confidence: 0.2, falsePositives: 0 }
            : null,
      }),
    );
    expect(d.action).toBe('ALLOW');
  });

  test('regra do usuário (prefixo) bloqueia antes do score', () => {
    const rule: Rule = {
      id: 'r1',
      name: 'Bloqueia 4002',
      enabled: true,
      action: 'BLOCK',
      match: { kind: 'prefix', value: '+55114002' },
    };
    const d = decide(baseInput({ ctx: ctx('1140028922'), rules: [rule] }));
    expect(d.action).toBe('BLOCK');
    expect(d.reasons).toContain('USER_RULE');
  });

  test('regra regex inválida não derruba o motor', () => {
    const rule: Rule = { id: 'r2', name: 'Regex ruim', enabled: true, action: 'BLOCK', match: { kind: 'regex', pattern: '([invalid' } };
    const d = decide(baseInput({ ctx: ctx('1130614000'), rules: [rule] }));
    expect(d.action).toBe('ALLOW');
  });

  test('fail-safe: lookup que lança erro → ALLOW', () => {
    const d = decide(
      baseInput({
        ctx: ctx('+5511987654321'),
        lookupReputation: () => {
          throw new Error('DB corrompido');
        },
      }),
    );
    expect(d.action).toBe('ALLOW');
  });

  test('0303 silenciado no modo BALANCED', () => {
    const d = decide(baseInput({ ctx: ctx('03033130303') }));
    expect(d.action).toBe('SILENCE');
    expect(d.reasons).toContain('BRAZIL_RULE');
  });

  test('0303 permitido quando configurado allow', () => {
    const d = decide(
      baseInput({
        ctx: ctx('03033130303'),
        config: {
          mode: 'CUSTOM',
          blockThreshold: 80,
          silenceThreshold: 90,
          warnThreshold: 60,
          handle0303: 'allow',
          blockUnknownInAggressive: false,
        },
      }),
    );
    expect(d.action).toBe('ALLOW');
  });

  test('campanha detectada soma score', () => {
    const now = new Date('2026-06-01T15:00:00'); // igual ao ctx.at dos recentes
    const recent = [
      { number: '+551140028922', at: new Date(now.getTime() - 60_000) },
      { number: '+551140028923', at: new Date(now.getTime() - 120_000) },
      { number: '+551140028924', at: new Date(now.getTime() - 180_000) },
    ];
    const d = decide(baseInput({ ctx: ctx('+551140028999'), recentCalls: recent }));
    expect(d.score).toBeGreaterThan(0);
    expect(d.explanation.join(' ') + d.reasons.join(' ')).toMatch(/campanha/i);
  });

  test('modo AGGRESSIVE bloqueia internacional', () => {
    const d = decide(baseInput({ ctx: ctx('+14155552671'), config: MODE_DEFAULTS.AGGRESSIVE }));
    expect(d.action).toBe('BLOCK');
  });
});
