import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CATEGORIES, DEFAULT_CONFIG, computeReputation, reporterWeight,
  type Category, type ReportInput, type ReporterStats,
} from '../src/index.ts';

const root = new URL('../../../data/', import.meta.url);
const vectors = JSON.parse(readFileSync(new URL('test-vectors/reputation.json', root), 'utf8'));
const categoriesJson = JSON.parse(readFileSync(new URL('rules/categories.json', root), 'utf8'));
const now = Date.parse(vectors.now);

type Profile = { age_days: number; agreements: number; disagreements: number; quarantined: boolean };
const stats = (p: Profile): ReporterStats => ({
  ageDays: p.age_days, agreements: p.agreements, disagreements: p.disagreements, quarantined: p.quarantined,
});

test('peso do denunciante por perfil', () => {
  for (const v of vectors.reporter_weights) {
    assert.equal(reporterWeight(stats(vectors.profiles[v.profile])), v.weight, v.profile);
  }
});

test('data/rules/categories.json espelha a configuração padrão', () => {
  assert.deepEqual(categoriesJson.categories.map((c: { id: string }) => c.id), [...CATEGORIES]);
  for (const c of categoriesJson.categories) assert.equal(DEFAULT_CONFIG.severity[c.id as Category], c.severity, c.id);
  assert.deepEqual(categoriesJson.labels, DEFAULT_CONFIG.labels);
});

for (const c of vectors.cases) {
  test(c.name, () => {
    const reports: ReportInput[] = c.reports.map((r: { reporter: string; category: Category; hours_ago: number; profile: string; network?: string }) => {
      const p = vectors.profiles[r.profile] as Profile;
      return {
        reporter: r.reporter, category: r.category, at: now - r.hours_ago * 3_600_000,
        weight: reporterWeight(stats(p)), reporterAgeDays: p.age_days, network: r.network,
      };
    });
    const ctx = c.context ?? {};
    const rep = computeReputation(reports, now, {
      neverBlock: ctx.never_block, contestAccepted: ctx.contest_accepted, pendingContest: ctx.pending_contest,
    });
    const e = c.expect;
    const info = JSON.stringify({ score: rep.score, label: rep.label, w: rep.weightedReporters, blockedBy: rep.blockedBy });
    if (e.score !== undefined) assert.equal(rep.score, e.score, info);
    if (e.score_min !== undefined) assert.ok(rep.score >= e.score_min, info);
    if (e.score_max !== undefined) assert.ok(rep.score <= e.score_max, info);
    if (e.label !== undefined) assert.equal(rep.label, e.label, info);
    if (e.category !== undefined) assert.equal(rep.category, e.category, info);
    if (e.publishable !== undefined) assert.equal(rep.publishable, e.publishable, info);
    if (e.insufficient !== undefined) assert.equal(rep.insufficientEvidence, e.insufficient, info);
    if (e.burst !== undefined) assert.equal(rep.burstQuarantine, e.burst, info);
    if (e.disputed !== undefined) assert.equal(rep.disputed, e.disputed, info);
    if (e.distinct !== undefined) assert.equal(rep.distinctReporters, e.distinct, info);
    for (const b of e.blocked_by_includes ?? []) assert.ok(rep.blockedBy.includes(b), info);
  });
}

test('determinístico e sem efeito de ordem', () => {
  const reports: ReportInput[] = Array.from({ length: 6 }, (_, i) => ({
    reporter: `r${i}`, category: 'PIX_SCAM', at: now - (60 + i) * 3_600_000, weight: 0.7, reporterAgeDays: 120,
  }));
  const a = computeReputation(reports, now);
  const b = computeReputation([...reports].reverse(), now);
  assert.deepEqual(a, b);
});

test('denúncia com data futura é ignorada (relógio do cliente não manipula recência)', () => {
  const rep = computeReputation([{ reporter: 'f', category: 'BANK_SCAM', at: now + 86_400_000, weight: 1, reporterAgeDays: 300 }], now);
  assert.equal(rep.distinctReporters, 0);
});
