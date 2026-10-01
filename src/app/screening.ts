/**
 * Serviço de screening — ponte entre o motor puro e o mundo (nativo ou simulador).
 *
 * Expo Go: fluxo completo com chamadas SIMULADAS (demonstração/testes).
 * Development build Android: o CallScreeningService nativo chama `ingestIncomingCall()`.
 */
import * as Notifications from 'expo-notifications';
import type { CallContext, CallDecision, HistoryEntry, ReportCategory } from '../core/types';
import { decide } from '../core/decision/decisionEngine';
import { formatDisplay, normalizePhone } from '../core/phone/normalize';
import { applyReport } from '../core/reputation/localReputation';
import { SpamDatabase } from '../core/database/spamDatabase';
import { seedDatabase } from '../core/database/seed';
import { addHistory, getState, updateHistory } from './store';
import { isNativeScreeningAvailable, notifyNativeDecision } from './nativeBridge';

let db: SpamDatabase | null = null;

export function getDb(): SpamDatabase {
  if (!db) db = new SpamDatabase();
  return db;
}

let dbReady: Promise<void> | null = null;
export async function ensureDb(): Promise<void> {
  if (!dbReady) {
    dbReady = (async () => {
      const database = getDb();
      await database.load();
      if (database.size === 0) {
        for (const e of seedDatabase()) database.upsert(e);
        await database.persist();
      }
    })();
  }
  return dbReady;
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Ponto de entrada de uma chamada recebida (nativa ou simulada).
 * Executa o pipeline completo e registra tudo localmente.
 */
export async function ingestIncomingCall(ctx: CallContext, simulated = false): Promise<CallDecision> {
  await ensureDb();
  const s = getState();

  // Conjunto de números dos contatos: resolvido LOCALMENTE (nunca enviado a lugar nenhum).
  const contactNumbers = new Set<string>();
  for (const c of s.allowlist) contactNumbers.add(c);
  const previouslyBlocked = new Set(
    s.history.filter((h) => h.action === 'BLOCK' && h.reasons.includes('USER_RULE')).map((h) => h.number),
  );
  const previouslyAllowed = new Set(
    s.history.filter((h) => h.action === 'ALLOW' && h.reasons.includes('ALLOWLIST')).map((h) => h.number),
  );

  const recentCalls = s.history.slice(0, 50).map((h) => ({ number: h.number, at: h.at }));

  const decision = decide({
    ctx,
    config: s.config,
    rules: s.rules,
    allowlist: s.allowlist,
    blacklist: s.blacklist,
    lookupReputation: (canonical) => getDb().get(canonical),
    recentCalls,
    previouslyBlocked,
    previouslyAllowed,
  });

  const entry: HistoryEntry = {
    id: genId(),
    number: decision.normalized.canonical,
    display: formatDisplay(decision.normalized.canonical),
    name: ctx.contactName ?? null,
    at: ctx.at.toISOString(),
    action: decision.action,
    score: decision.score,
    reasons: decision.reasons,
    category: null,
    simulated,
  };
  addHistory(entry);

  if (s.settings.notifications && (decision.action === 'BLOCK' || decision.action === 'WARN' || decision.action === 'SILENCE')) {
    void notifyLocal(entry, decision).catch(() => {});
  }

  if (isNativeScreeningAvailable()) {
    void notifyNativeDecision(decision.normalized.canonical, decision.action).catch(() => {});
  }
  return decision;
}

async function notifyLocal(entry: HistoryEntry, d: CallDecision): Promise<void> {
  const labels: Record<string, string> = {
    BLOCK: '🚫 Bloqueada',
    SILENCE: '🔇 Silenciada',
    WARN: '⚠️ Suspeita',
  };
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `AntiSpam BR — ${labels[d.action] ?? d.action}`,
      body: `${entry.display} · score ${d.score}/100`,
      sound: false,
    },
    trigger: null, // imediato
  });
}

/** Denúncia do usuário sobre uma chamada do histórico (alimenta a base local). */
export async function reportHistoryEntry(entryId: string, category: ReportCategory): Promise<void> {
  await ensureDb();
  const s = getState();
  const entry = s.history.find((h) => h.id === entryId);
  if (!entry || !entry.number) return;

  const existing = getDb().get(entry.number);
  // reporterId local anônimo: não é identidade real, serve só para anti-abuse local.
  let reporterId = '';
  try {
    const { hashPrefix } = await import('../core/security/sha256');
    reporterId = hashPrefix(entry.number, 4);
  } catch {
    reporterId = 'local';
  }
  const updated = applyReport(existing, { category, reporterId });
  updated.key = entry.number;
  getDb().upsert(updated);
  await getDb().persist();
  updateHistory(entryId, { category });
}

/** Simula uma chamada recebida (Expo Go / demo / testes de UI). */
export async function simulateCall(rawNumber: string, opts?: { stirShaken?: CallContext['stirShaken'] }): Promise<CallDecision> {
  const n = normalizePhone(rawNumber);
  const ctx: CallContext = {
    rawNumber,
    at: new Date(),
    presentation: 'UNKNOWN',
    contactName: null,
    stirShaken: opts?.stirShaken ?? 'UNKNOWN',
  };
  return ingestIncomingCall(ctx, true);
}
