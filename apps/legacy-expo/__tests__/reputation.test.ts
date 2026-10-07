import { applyReport, applyFalsePositive, recomputeScore } from '../src/core/reputation/localReputation';
import { SpamDatabase } from '../src/core/database/spamDatabase';
import { buildPixPayload } from '../src/core/donation/pix';
import { hashPrefix } from '../src/core/security/sha256';

describe('Reputação local (anti-abuse)', () => {
  test('1 denúncia isolada tem score baixo', () => {
    const e = applyReport(null, { category: 'spam', reporterId: 'a' });
    e.key = '+5511999990001';
    expect(e.reports).toBe(1);
    expect(e.score).toBeLessThan(30);
  });

  test('muitas denúncias de denunciantes únicos saturam alto', () => {
    let e = null as ReturnType<typeof applyReport> | null;
    for (let i = 0; i < 20; i++) e = applyReport(e, { category: 'fraude', reporterId: `rep-${i}` });
    e!.key = '+5511999990002';
    expect(e!.score).toBeGreaterThan(80);
  });

  test('falso positivo reduz score e confiança', () => {
    let e = applyReport(null, { category: 'golpe', reporterId: 'x' });
    for (let i = 0; i < 9; i++) e = applyReport(e, { category: 'golpe', reporterId: `y${i}` });
    const before = e.score;
    e = applyFalsePositive(e);
    expect(e.score).toBeLessThan(before);
    expect(e.falsePositives).toBe(1);
  });

  test('mesmo denunciante repetido não engana o sistema', () => {
    let e = applyReport(null, { category: 'spam', reporterId: 'solo' });
    for (let i = 0; i < 9; i++) e = applyReport(e, { category: 'spam', reporterId: 'solo' });
    expect(e.uniqueReporters).toBe(1);
    const soloScore = e.score;
    let e2 = applyReport(null, { category: 'spam', reporterId: 'p1' });
    for (let i = 0; i < 9; i++) e2 = applyReport(e2, { category: 'spam', reporterId: `p${i + 1}` });
    expect(e2.score).toBeGreaterThan(soloScore);
  });

  test('recomputeScore respeita recência', () => {
    const old = {
      key: 'k',
      country: 'BR',
      category: 'spam' as const,
      score: 90,
      reports: 30,
      uniqueReporters: 25,
      firstSeen: '2020-01-01T00:00:00Z',
      lastSeen: '2020-06-01T00:00:00Z',
      confidence: 0.9,
      falsePositives: 0,
    };
    expect(recomputeScore(old)).toBeLessThan(40);
  });
});

describe('SpamDatabase', () => {
  test('merge de delta rejeita registros malformados', async () => {
    const db = new SpamDatabase();
    await db.load();
    const result = await db.applyDelta(
      {
        entries: [
          { key: '+5511999990003', country: 'BR', category: 'spam', score: 80, reports: 5, uniqueReporters: 4 },
          { key: 'x', category: 'spam', score: 999 }, // inválido
          null, // inválido
        ],
      },
      () => true,
    );
    expect(result.applied).toBe(1);
    expect(result.rejected).toBe(2);
  });

  test('delta sem verificação criptográfica é rejeitado', async () => {
    const db = new SpamDatabase();
    await db.load();
    await expect(db.applyDelta({ entries: [] }, () => false)).rejects.toThrow();
  });
});

describe('PIX BR Code', () => {
  test('payload contém GUI do BACEN, valor e CRC válido', () => {
    const p = buildPixPayload({ key: 'teste@antispam.br', merchantName: 'AntiSpam BR', merchantCity: 'BRASIL', amount: 10, txid: 'ANTISPAMBR' });
    expect(p).toContain('br.gov.bcb.pix');
    expect(p).toContain('54'); // amount
    expect(p.startsWith('000201')).toBe(true);
    expect(/6304[0-9A-F]{4}$/.test(p)).toBe(true);
  });
});

describe('Hash prefix (privacy)', () => {
  test('sha256 truncado é determinístico e não expõe o número', () => {
    const h1 = hashPrefix('+5511999999999', 8);
    const h2 = hashPrefix('+5511999999999', 8);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(8);
    expect(h1).not.toContain('5511');
  });
});
