/**
 * COMMUNITY API — M8 (Express).
 *
 * Endpoints (missão §COMMUNITY API):
 *   GET  /v1/numbers/:hash/reputation   — reputação por hash (nunca número cru)
 *   POST /v1/reports                    — denúncia (hash-only)
 *   POST /v1/reports/:id/vote           — confirmar/contestar
 *   POST /v1/numbers/:hash/legitimate   — contestação de classificação
 *   GET  /v1/datasets/manifest          — manifest assinado atual
 *   GET  /v1/datasets/:version          — dataset versionado
 *   GET  /v1/campaigns                  — campanhas de golpe ativas
 *
 * PRIVACIDADE: a API só conhece SHA-256 do número (hash truncado no lookup futuro p/ k-anonymity).
 * Persistência: interface ReportStore (Postgres em produção; InMemory p/ dev/testes).
 */

import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { computeCommunityReputation, type CommunityReport } from './reputation';
import { acceptReports, type ReporterStats } from './antibuse';
import type { DatasetManifest } from './datasets';

export interface ReportStore {
  add(report: CommunityReport & { id: string; weight: number }): void;
  byNumber(numberHash: string): Array<CommunityReport & { id: string; weight: number }>;
  all(): Array<CommunityReport & { id: string; weight: number }>;
}

export class InMemoryStore implements ReportStore {
  private reports: Array<CommunityReport & { id: string; weight: number }> = [];
  private seq = 0;
  /** Chaves de dedup (numberHash+reporterHash+minuto) — persiste entre requests. */
  private seenKeys = new Set<string>();

  add(report: CommunityReport & { id: string; weight: number }): void {
    this.reports.push(report);
    this.seenKeys.add(`${report.numberHash}:${report.reporterHash}:${Math.floor(report.at.getTime() / 60_000)}`);
  }
  byNumber(numberHash: string) {
    return this.reports.filter((r) => r.numberHash === numberHash);
  }
  all() {
    return [...this.reports];
  }
  nextId(): string {
    return `r_${(++this.seq).toString(36)}`;
  }
  seen(): Set<string> {
    return this.seenKeys;
  }
}

export interface ServerDeps {
  store: ReportStore;
  reporterStats: Map<string, ReporterStats>;
  currentManifest: DatasetManifest | null;
  /** Chaves de dedup compartilhadas (InMemoryStore expõe; Postgres usa constraint). */
  seenKeys?: Set<string>;
}

const VALID_CATEGORIES = new Set([
  'TELEMARKETING', 'ROBOCALL', 'SILENT_CALL', 'COLLECTION', 'BANK_SCAM',
  'PIX_SCAM', 'PHISHING', 'DELIVERY_SCAM', 'FAKE_SUPPORT', 'LOAN',
  'SURVEY', 'SPOOFING', 'LEGITIMATE', 'OTHER',
]);

const HASH_REGEX = /^[a-f0-9]{64}$/;

export function createApp(deps: ServerDeps) {
  const app = express();
  app.use(express.json({ limit: '16kb' })); // anti-abuse: payload pequeno

  // ---------- Portal comunitário (M5) — servido pela própria API ----------
  // Localiza apps/web a partir do cwd (services/api em dev, raiz no CI/Docker).
  const webCandidates = [
    path.resolve(process.cwd(), 'apps/web'),
    path.resolve(process.cwd(), '../apps/web'),
  ];
  const webRoot = webCandidates.find((c) => fs.existsSync(path.join(c, 'index.html')));
  if (webRoot) {
    app.use(express.static(webRoot));
  }

  // health
  app.get('/v1/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'antispam-br-api', version: 'v1' });
  });

  // GET reputation
  app.get('/v1/numbers/:hash/reputation', (req: Request, res: Response) => {
    const { hash } = req.params;
    if (!HASH_REGEX.test(hash)) {
      res.status(400).json({ error: 'number_hash inválido (esperado sha256 hex de 64)' });
      return;
    }
    const reports = deps.store.byNumber(hash);
    const rep = computeCommunityReputation(
      reports.map(({ id: _id, weight: _w, ...r }) => r),
    );
    // Expõe apenas agregados — sem listagem de denúncias individuais (anti-assédio).
    res.json({
      number_hash: hash,
      score: rep.score,
      label: rep.label,
      total_reports: rep.totalReports,
      distinct_reporters: rep.distinctReporters,
    });
  });

  // POST report
  app.post('/v1/reports', (req: Request, res: Response) => {
    const b = req.body ?? {};
    const errors: string[] = [];
    if (!HASH_REGEX.test(b.number_hash ?? '')) errors.push('number_hash');
    if (!VALID_CATEGORIES.has(b.category)) errors.push('category');
    if (typeof b.confidence !== 'number' || b.confidence < 0 || b.confidence > 1) errors.push('confidence');
    if (!['USER_REPORT', 'USER_CONFIRMATION', 'USER_CONTEST', 'LOCAL_PATTERN', 'PARTNER_FEED'].includes(b.source)) errors.push('source');
    if (typeof b.reporter_hash !== 'string' || b.reporter_hash.length < 8) errors.push('reporter_hash');
    if (errors.length) {
      res.status(422).json({ error: 'payload inválido', fields: errors });
      return;
    }

    const report: CommunityReport = {
      numberHash: b.number_hash,
      category: b.category,
      at: b.timestamp ? new Date(b.timestamp) : new Date(),
      reporterHash: b.reporter_hash,
      confidence: b.confidence,
      source: b.source,
    };

    const { accepted, rejected } = acceptReports([report], deps.reporterStats, new Date(), deps.seenKeys);
    if (!accepted.length) {
      res.status(429).json({ error: 'denúncia rejeitada', reason: rejected[0]?.reason ?? 'UNKNOWN' });
      return;
    }

    const id = deps.store instanceof InMemoryStore ? (deps.store as InMemoryStore).nextId() : `r_${Date.now()}`;
    deps.store.add({ ...report, id, weight: accepted[0].weight });

    res.status(201).json({ id, accepted: true });
  });

  // POST vote
  app.post('/v1/reports/:id/vote', (req: Request, res: Response) => {
    const { id } = req.params;
    const { vote, reporter_hash } = req.body ?? {};
    const report = deps.store.all().find((r) => r.id === id);
    if (!report) {
      res.status(404).json({ error: 'denúncia não encontrada' });
      return;
    }
    if (!['confirm', 'contest'].includes(vote)) {
      res.status(422).json({ error: 'vote deve ser confirm|contest' });
      return;
    }

    // Vira uma denúncia derivada: confirmação reforça; contestação cria LEGITIMATE.
    const derived: CommunityReport = {
      numberHash: report.numberHash,
      category: vote === 'contest' ? 'LEGITIMATE' : report.category,
      at: new Date(),
      reporterHash: String(reporter_hash ?? 'anon'),
      confidence: 0.8,
      source: vote === 'contest' ? 'USER_CONTEST' : 'USER_CONFIRMATION',
    };
    const { accepted } = acceptReports([derived], deps.reporterStats);
    if (accepted.length) {
      deps.store.add({ ...derived, id: `${id}_v`, weight: accepted[0].weight });
    }
    res.json({ ok: true, counted: accepted.length > 0 });
  });

  // POST legitimate (contestação direta de número)
  app.post('/v1/numbers/:hash/legitimate', (req: Request, res: Response) => {
    const { hash } = req.params;
    if (!HASH_REGEX.test(hash)) {
      res.status(400).json({ error: 'number_hash inválido' });
      return;
    }
    const { reporter_hash } = req.body ?? {};
    const contest: CommunityReport = {
      numberHash: hash,
      category: 'LEGITIMATE',
      at: new Date(),
      reporterHash: String(reporter_hash ?? 'anon'),
      confidence: 0.9,
      source: 'USER_CONTEST',
    };
    const { accepted } = acceptReports([contest], deps.reporterStats);
    if (accepted.length) {
      deps.store.add({ ...contest, id: `leg_${Date.now()}`, weight: accepted[0].weight });
    }
    res.status(201).json({ ok: true, counted: accepted.length > 0 });
  });

  // GET datasets manifest
  app.get('/v1/datasets/manifest', (_req: Request, res: Response) => {
    if (!deps.currentManifest) {
      res.status(404).json({ error: 'nenhum dataset publicado' });
      return;
    }
    res.json(deps.currentManifest);
  });

  // GET dataset version (metadados; binários ficam em storage/CDN)
  app.get('/v1/datasets/:version', (req: Request, res: Response) => {
    if (!deps.currentManifest || deps.currentManifest.version !== req.params.version) {
      res.status(404).json({ error: 'versão não encontrada' });
      return;
    }
    res.json({ version: req.params.version, files: deps.currentManifest.files, license: deps.currentManifest.license });
  });

  // GET campaigns (top números por rajada recente — agregado, sem dados pessoais)
  app.get('/v1/campaigns', (_req: Request, res: Response) => {
    const now = new Date();
    const byNumber = new Map<string, number>();
    for (const r of deps.store.all()) {
      if (now.getTime() - r.at.getTime() <= 48 * 3_600_000 && r.category !== 'LEGITIMATE') {
        byNumber.set(r.numberHash, (byNumber.get(r.numberHash) ?? 0) + 1);
      }
    }
    const campaigns = [...byNumber.entries()]
      .filter(([, n]) => n >= 5)
      .map(([number_hash, count]) => ({ number_hash, recent_reports: count, category: 'ACTIVE_BURST' }));
    res.json({ campaigns, generated_at: now.toISOString() });
  });

  return app;
}
