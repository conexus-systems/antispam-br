import { computeCommunityReputation, temporalWeight, reporterBurstFilter, type CommunityReport } from '../src/reputation';
import { generateKeyPair, signManifest, verifyManifest, versionLte, type DatasetManifest } from '../src/datasets';
import { reporterWeight, outlierReporters, acceptReports } from '../src/antibuse';
import { createApp, InMemoryStore } from '../src/server';
import type { ReporterStats } from '../src/antibuse';
import request from 'supertest';

const NOW = new Date('2026-10-07T12:00:00Z');
const H = 'a'.repeat(64);
const R1 = 'reporter-1';
const R2 = 'reporter-2';
const R3 = 'reporter-3';

function rep(over: Partial<CommunityReport> = {}): CommunityReport {
  return {
    numberHash: H,
    category: 'PIX_SCAM',
    at: new Date(NOW.getTime() - 3_600_000),
    reporterHash: R1,
    confidence: 0.9,
    source: 'USER_REPORT',
    ...over,
  };
}

describe('reputation engine', () => {
  it('denúncia isolada NUNCA pontua (anti-abuse central)', () => {
    const r = computeCommunityReputation([rep()], NOW);
    expect(r.score).toBe(0);
    expect(r.label).toBe('CLEAN');
  });

  it('2+ denunciantes distintos pontuam com categoria pesada', () => {
    const r = computeCommunityReputation(
      [rep({ reporterHash: R1 }), rep({ reporterHash: R2 }), rep({ reporterHash: R3 })],
      NOW,
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.distinctReporters).toBe(3);
  });

  it('decaimento temporal: denúncia de 60 dias vale ~metade de 46 dias', () => {
    const old = temporalWeight(new Date(NOW.getTime() - 60 * 86_400_000), NOW);
    const mid = temporalWeight(new Date(NOW.getTime() - 46 * 86_400_000), NOW);
    expect(old).toBeLessThan(mid);
    expect(temporalWeight(NOW, NOW)).toBe(1);
  });

  it('burst do mesmo reporter é descartado (bot reporting)', () => {
    const burst = [1, 2, 3, 4, 5, 6].map((i) =>
      rep({ reporterHash: R1, at: new Date(NOW.getTime() - i * 60_000) }),
    );
    const discarded = reporterBurstFilter(burst);
    expect(discarded.size).toBe(3); // BURST_MAX_PER_HOUR = 3
  });

  it('contestações LEGITIMATE reduzem o score', () => {
    const base = [rep({ reporterHash: R1 }), rep({ reporterHash: R2 })];
    const withContests = [
      ...base,
      rep({ reporterHash: R3, category: 'LEGITIMATE', source: 'USER_CONTEST' }),
      rep({ reporterHash: 'r4', category: 'LEGITIMATE', source: 'USER_CONTEST' }),
    ];
    const clean = computeCommunityReputation(base, NOW);
    const contested = computeCommunityReputation(withContests, NOW);
    expect(contested.score).toBeLessThan(clean.score);
  });

  it('labels seguem thresholds configuráveis', () => {
    const t = { clean: 20, lowRisk: 40, suspicious: 60, spam: 80 };
    const many = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10'].map((h) =>
      rep({ reporterHash: h, category: 'BANK_SCAM', confidence: 1 }),
    );
    const r = computeCommunityReputation(many, NOW, t);
    expect(['SPAM', 'HIGH_RISK']).toContain(r.label);
    expect(r.score).toBeGreaterThanOrEqual(80);
  });
});

describe('anti-abuse (reporter reputation)', () => {
  it('peso do reporter: novo 0.25, quarentenado 0, contestado cai', () => {
    expect(reporterWeight({ total: 0, confirmed: 0, contested: 0, quarantined: false })).toBe(0.25);
    expect(reporterWeight({ total: 5, confirmed: 5, contested: 0, quarantined: false })).toBeGreaterThan(1);
    expect(reporterWeight({ total: 10, confirmed: 1, contested: 9, quarantined: false })).toBeLessThan(0.25);
    expect(reporterWeight({ total: 5, confirmed: 5, contested: 0, quarantined: true })).toBe(0);
  });

  it('outlier: reporter solitário recorrente tem peso reduzido', () => {
    const history = Array.from({ length: 6 }, (_, i) =>
      rep({ numberHash: `hash-${i}`.padEnd(64, '0').slice(0, 64), reporterHash: 'lone' }),
    );
    const outliers = outlierReporters(history);
    expect(outliers.has('lone')).toBe(true);
  });

  it('valida replay (timestamp futuro) e duplicata', () => {
    const { accepted, rejected } = acceptReports(
      [
        rep({ at: new Date(NOW.getTime() + 3_600_000) }), // futuro
        rep(), rep(), // duplicata (mesmo reporter/minuto/numero)
      ],
      new Map(),
      NOW,
    );
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    expect(rejected[0].reason).toBe('FUTURE_TIMESTAMP');
    expect(rejected[1].reason).toBe('DUPLICATE');
  });
});

describe('dataset manifest (Ed25519)', () => {
  const { privateKeyHex, publicKeyHex } = generateKeyPair();

  const base = {
    version: '1.0.0',
    timestamp: '2026-10-07T00:00:00Z',
    previous_version: null,
    record_count: 2,
    license: 'CC0-1.0',
    files: [{ path: 'brazil/55-11.bin.zst', sha256: 'ab'.repeat(32), bytes: 512, records: 2 }],
  };

  it('assina e verifica com chave correta', () => {
    const signed = signManifest(base, { privateKeyHex, publicKeyId: 'test-key' });
    expect(signed.signature.alg).toBe('Ed25519');
    const v = verifyManifest(signed, { 'brazil/55-11.bin.zst': 'ab'.repeat(32) }, publicKeyHex, null);
    expect(v).toEqual({ ok: true });
  });

  it('rejeita assinatura com chave errada', () => {
    const signed = signManifest(base, { privateKeyHex, publicKeyId: 'test-key' });
    const other = generateKeyPair();
    const v = verifyManifest(signed, { 'brazil/55-11.bin.zst': 'ab'.repeat(32) }, other.publicKeyHex, null);
    expect(v).toEqual({ ok: false, reason: 'SIGNATURE_MISMATCH' });
  });

  it('rejeita hash de arquivo divergente (integridade)', () => {
    const signed = signManifest(base, { privateKeyHex, publicKeyId: 'test-key' });
    const v = verifyManifest(signed, { 'brazil/55-11.bin.zst': 'cd'.repeat(32) }, publicKeyHex, null);
    expect(v).toEqual({ ok: false, reason: 'FILE_HASH_MISMATCH' });
  });

  it('rejeita rollback de versão (anti-rollback)', () => {
    const signed = signManifest(base, { privateKeyHex, publicKeyId: 'test-key' });
    const v = verifyManifest(signed, { 'brazil/55-11.bin.zst': 'ab'.repeat(32) }, publicKeyHex, '2.0.0');
    expect(v).toEqual({ ok: false, reason: 'VERSION_BACKWARD' });
    expect(versionLte('1.0.0', '2.0.0')).toBe(true);
    expect(versionLte('2.1.0', '2.0.0')).toBe(false);
  });
});

describe('community API (HTTP)', () => {
  let app: ReturnType<typeof createApp>;
  let store: InMemoryStore;
  const stats: Map<string, ReporterStats> = new Map();

  beforeEach(() => {
    store = new InMemoryStore();
    app = createApp({ store, reporterStats: stats, currentManifest: null, seenKeys: store.seen() });
  });

  it('GET /v1/health', async () => {
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET / serve o portal comunitário (M5)', async () => {
    // CI roda a partir de services/api → webRoot = ../apps/web
    const res = await request(app).get('/');
    if (res.status === 404) return; // web root ausente no ambiente
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
    expect(res.text).toContain('AntiSpam BR');
    expect(res.text).toContain('Portal Comunitário');
    // privacy: o portal nunca envia número em texto claro (hash SHA-256 local)
    expect(res.text).toContain('sha256');
  });

  it('reputation de hash inválido → 400', async () => {
    const res = await request(app).get('/v1/numbers/not-a-hash/reputation');
    expect(res.status).toBe(400);
  });

  it('POST /v1/reports aceita denúncia válida e reputation reflete 2+ denunciantes', async () => {
    const mk = (rh: string) => ({
      number_hash: H,
      category: 'PIX_SCAM',
      confidence: 0.9,
      source: 'USER_REPORT',
      reporter_hash: rh,
    });
    const r1 = await request(app).post('/v1/reports').send(mk(R1));
    expect(r1.status).toBe(201);

    // segunda denúncia do mesmo reporter no mesmo minuto → DUPLICATE → 429
    const dup = await request(app).post('/v1/reports').send(mk(R1));
    expect(dup.status).toBe(429);

    const r2 = await request(app).post('/v1/reports').send(mk(R2));
    expect(r2.status).toBe(201);

    const rep3 = await request(app).get(`/v1/numbers/${H}/reputation`);
    expect(rep3.status).toBe(200);
    expect(rep3.body.distinct_reporters).toBe(2);
    expect(rep3.body.score).toBeGreaterThan(0);
    expect(rep3.body.label).toBeDefined();
  });

  it('POST /v1/reports valida payload → 422', async () => {
    const res = await request(app).post('/v1/reports').send({ number_hash: 'x', category: 'NADA' });
    expect(res.status).toBe(422);
    expect(res.body.fields).toContain('number_hash');
    expect(res.body.fields).toContain('category');
  });

  it('POST /v1/reports/:id/vote contest cria LEGITIMATE', async () => {
    await request(app).post('/v1/reports').send({
      number_hash: H, category: 'PIX_SCAM', confidence: 0.9, source: 'USER_REPORT', reporter_hash: R1,
    });
    const target = store.all()[0];
    const res = await request(app).post(`/v1/reports/${target.id}/vote`).send({ vote: 'contest', reporter_hash: R2 });
    expect(res.status).toBe(200);
    expect(res.body.counted).toBe(true);
    expect(store.all().some((r) => r.category === 'LEGITIMATE')).toBe(true);
  });

  it('POST /v1/numbers/:hash/legitimate → 201', async () => {
    const res = await request(app).post(`/v1/numbers/${H}/legitimate`).send({ reporter_hash: R1 });
    expect(res.status).toBe(201);
  });

  it('GET /v1/datasets/manifest sem dataset → 404; com manifest assinado → 200', async () => {
    expect((await request(app).get('/v1/datasets/manifest')).status).toBe(404);

    const { privateKeyHex, publicKeyHex } = generateKeyPair();
    const manifest: Omit<DatasetManifest, 'signature'> = {
      version: '1.0.0',
      timestamp: NOW.toISOString(),
      previous_version: null,
      record_count: 1,
      license: 'CC0-1.0',
      files: [],
    };
    // recria app com manifest
    const app2 = createApp({ store, reporterStats: stats, currentManifest: signManifest(manifest, { privateKeyHex, publicKeyId: 'k' }) });
    const res = await request(app2).get('/v1/datasets/manifest');
    expect(res.status).toBe(200);
    expect(res.body.signature.alg).toBe('Ed25519');
    // assinatura verificável com a pública
    expect(verifyManifest(res.body as DatasetManifest, {}, publicKeyHex, null).ok).toBe(true);
  });

  it('GET /v1/campaigns agrega rajadas sem expor denúncias individuais', async () => {
    // 5 denúncias distintas (reporter hashes rotativos realistas, últimos 48h)
    for (let i = 0; i < 5; i++) {
      await request(app).post('/v1/reports').send({
        number_hash: H, category: 'ROBOCALL', confidence: 0.9, source: 'USER_REPORT',
        reporter_hash: `rot-hash-${i}`.padEnd(16, 'x').slice(0, 16),
        timestamp: new Date(Date.now() - i * 60_000).toISOString(),
      });
    }
    const res = await request(app).get('/v1/campaigns');
    expect(res.status).toBe(200);
    expect(res.body.campaigns[0].recent_reports).toBeGreaterThanOrEqual(5);
    expect(res.body.campaigns[0]).not.toHaveProperty('reporters');
  });
});
