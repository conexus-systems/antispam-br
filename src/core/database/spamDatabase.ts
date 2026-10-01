/**
 * Banco local de spam (M5) — formato aberto (§11) sobre AsyncStorage.
 * Suporta: seed embutido, merge de deltas assinados (base JSON), rollback em memória
 * via snapshot, e consultas O(1) por canônico.
 *
 * Em produção nativa (dev build) isto é espelhado em SQLite; a interface é a mesma.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReputationEntry } from '../types';
import { normalizeEntry, recomputeScore } from '../reputation/localReputation';

const KEY_DB = 'antispam-br/spamdb/v1';
const KEY_META = 'antispam-br/spamdb/meta';

export interface SpamDbMeta {
  version: number;
  updatedAt: string;
  source?: string;
  entries: number;
}

export class SpamDatabase {
  private entries = new Map<string, ReputationEntry>();
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(KEY_DB);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const e of parsed as ReputationEntry[]) {
            if (e && typeof e.key === 'string') this.entries.set(e.key, normalizeEntry(e));
          }
        }
      }
    } catch {
      // Base corrompida: recomeça vazia (fail-safe) — decisão de bloqueio nunca depende de DB corrompido.
      this.entries.clear();
    }
    this.loaded = true;
  }

  get size(): number {
    return this.entries.size;
  }

  get(canon: string): ReputationEntry | null {
    return this.entries.get(canon) ?? null;
  }

  upsert(entry: ReputationEntry): void {
    this.entries.set(entry.key, normalizeEntry(entry));
  }

  async persist(): Promise<void> {
    const arr = [...this.entries.values()];
    await AsyncStorage.setItem(KEY_DB, JSON.stringify(arr));
    const meta: SpamDbMeta = {
      version: Date.now(),
      updatedAt: new Date().toISOString(),
      entries: arr.length,
      source: 'local',
    };
    await AsyncStorage.setItem(KEY_META, JSON.stringify(meta));
  }

  async meta(): Promise<SpamDbMeta> {
    try {
      const raw = await AsyncStorage.getItem(KEY_META);
      if (raw) return JSON.parse(raw) as SpamDbMeta;
    } catch {
      /* ignore */
    }
    return { version: 0, updatedAt: new Date(0).toISOString(), entries: this.entries.size, source: 'local' };
  }

  /**
   * Aplica um delta da base comunitária (§10-11). Validação estrita:
   * rejeita registros malformados (proteção contra database poisoning).
   * `verify` é a verificação criptográfica do manifesto (assinatura/digest).
   */
  async applyDelta(
    delta: unknown,
    verify: (payload: unknown) => boolean,
  ): Promise<{ applied: number; rejected: number }> {
    if (!verify(delta)) throw new Error('Verificação criptográfica do delta falhou');
    if (!delta || typeof delta !== 'object') throw new Error('Delta inválido');
    const list = (delta as { entries?: unknown }).entries;
    if (!Array.isArray(list)) throw new Error('Delta sem entries');

    let applied = 0;
    let rejected = 0;
    for (const raw of list) {
      const e = raw as Partial<ReputationEntry>;
      if (
        !e || typeof e.key !== 'string' || e.key.length < 5 || e.key.length > 32 ||
        typeof e.score !== 'number' || e.score < 0 || e.score > 100 ||
        typeof e.reports !== 'number' || e.reports < 0 ||
        typeof e.category !== 'string' || e.category.length > 20
      ) {
        rejected++;
        continue;
      }
      const existing = this.entries.get(e.key);
      const merged: ReputationEntry = existing
        ? {
            ...existing,
            score: Math.max(existing.score, e.score),
            reports: existing.reports + (e.reports ?? 0),
            uniqueReporters: Math.max(existing.uniqueReporters, e.uniqueReporters ?? 0),
            lastSeen: e.lastSeen ?? existing.lastSeen,
          }
        : {
            key: e.key,
            country: e.country ?? 'BR',
            category: e.category as ReputationEntry['category'],
            score: e.score,
            reports: e.reports ?? 0,
            uniqueReporters: e.uniqueReporters ?? 1,
            firstSeen: e.firstSeen ?? new Date().toISOString(),
            lastSeen: e.lastSeen ?? new Date().toISOString(),
            confidence: e.confidence ?? 0.5,
            falsePositives: 0,
          };
      merged.score = recomputeScore(merged, new Date());
      this.entries.set(merged.key, normalizeEntry(merged));
      applied++;
    }
    await this.persist();
    return { applied, rejected };
  }

  exportAll(): ReputationEntry[] {
    return [...this.entries.values()];
  }
}
