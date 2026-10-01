/**
 * Store global leve (sem dependências externas) — useSyncExternalStore.
 * Tudo persiste localmente via AsyncStorage. Nada sai do aparelho.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HistoryEntry, ProtectionMode, Rule } from '../core/types';
import type { Handle0303 } from '../core/phone/brazilRules';
import { MODE_DEFAULTS, type DecisionEngineConfig } from '../core/decision/decisionEngine';

const KEY_STATE = 'antispam-br/app-state/v1';

export interface AppState {
  hydrated: boolean;
  onboardingDone: boolean;
  mode: ProtectionMode;
  /** Config efetiva (modos padrão ou custom). */
  config: DecisionEngineConfig;
  rules: Rule[];
  allowlist: string[];
  blacklist: string[];
  history: HistoryEntry[];
  /** IA Assistente (OpenRouter) — off por padrão. */
  ai: { enabled: boolean; apiKey: string; model: string };
  donation: { pixKey?: string };
  settings: { notifications: boolean; haptics: boolean };
}

const initialState: AppState = {
  hydrated: false,
  onboardingDone: false,
  mode: 'BALANCED',
  config: MODE_DEFAULTS.BALANCED,
  rules: [],
  allowlist: [],
  blacklist: [],
  history: [],
  ai: { enabled: false, apiKey: '', model: '' },
  donation: {},
  settings: { notifications: true, haptics: true },
};

let state: AppState = initialState;
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
  void persist();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void AsyncStorage.setItem(KEY_STATE, JSON.stringify({ ...state, hydrated: undefined })).catch(() => {});
  }, 300);
}

export async function hydrate(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY_STATE);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<AppState>;
      const mode = (saved.mode ?? 'BALANCED') as ProtectionMode;
      state = {
        ...initialState,
        ...saved,
        hydrated: true,
        // Config derivada do modo salvo (ou custom preservada)
        config:
          saved.config && mode === 'CUSTOM'
            ? saved.config
            : MODE_DEFAULTS[mode as Exclude<ProtectionMode, 'CUSTOM'>] ?? MODE_DEFAULTS.BALANCED,
      };
    } else {
      state = { ...initialState, hydrated: true };
    }
  } catch {
    state = { ...initialState, hydrated: true };
  }
  for (const l of listeners) l();
}

/** Troca o modo de proteção e deriva a config. */
export function setMode(mode: ProtectionMode): void {
  if (mode === 'CUSTOM') {
    setState({ mode });
    return;
  }
  setState({ mode, config: MODE_DEFAULTS[mode] });
}

export function setCustomConfig(patch: Partial<DecisionEngineConfig>): void {
  setState({ mode: 'CUSTOM', config: { ...state.config, ...patch } });
}

export function addHistory(entry: HistoryEntry): void {
  setState({ history: [entry, ...state.history].slice(0, 500) });
}

export function updateHistory(id: string, patch: Partial<HistoryEntry>): void {
  setState({ history: state.history.map((h) => (h.id === id ? { ...h, ...patch } : h)) });
}

export function clearHistory(): void {
  setState({ history: [] });
}

export function upsertRule(rule: Rule): void {
  const exists = state.rules.some((r) => r.id === rule.id);
  setState({ rules: exists ? state.rules.map((r) => (r.id === rule.id ? rule : r)) : [...state.rules, rule] });
}

export function removeRule(id: string): void {
  setState({ rules: state.rules.filter((r) => r.id !== id) });
}

export function toggleList(list: 'allowlist' | 'blacklist', canonical: string): void {
  const current = state[list];
  setState({
    [list]: current.includes(canonical) ? current.filter((c) => c !== canonical) : [...current, canonical],
  } as Partial<AppState>);
}
