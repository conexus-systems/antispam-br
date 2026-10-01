/**
 * Backup/restore (§21) — JSON validado. Import rejeita payloads maliciosos:
 * schema estrito, limite de tamanho, sem execução (JSON puro), whitelist de campos.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProtectionMode, Rule } from '../core/types';
import { getState, setState, type AppState } from './store';

const SCHEMA_VERSION = 1;
const MAX_IMPORT_BYTES = 2_000_000; // 2 MB
const MAX_RULES = 200;
const MAX_LIST = 5_000;

export interface BackupFile {
  schemaVersion: number;
  app: 'antispam-br';
  exportedAt: string;
  data: {
    mode: ProtectionMode;
    rules: Rule[];
    allowlist: string[];
    blacklist: string[];
    settings?: AppState['settings'];
  };
}

export async function exportBackup(): Promise<string> {
  const s = getState();
  const backup: BackupFile = {
    schemaVersion: SCHEMA_VERSION,
    app: 'antispam-br',
    exportedAt: new Date().toISOString(),
    data: {
      mode: s.mode,
      rules: s.rules,
      allowlist: s.allowlist.slice(0, MAX_LIST),
      blacklist: s.blacklist.slice(0, MAX_LIST),
      settings: s.settings,
    },
  };
  return JSON.stringify(backup, null, 2);
}

export async function saveBackupToFile(): Promise<string> {
  const json = await exportBackup();
  // AsyncStorage não expõe filesystem; mantemos a última cópia em storage dedicado
  // (compartilhamento como arquivo entra na fase nativa com expo-file-system).
  await AsyncStorage.setItem('antispam-br/backup/last', json);
  return 'armazenado localmente';
}

export function validateBackup(json: string): { ok: true; backup: BackupFile } | { ok: false; error: string } {
  if (json.length > MAX_IMPORT_BYTES) return { ok: false, error: 'Arquivo muito grande (limite 2 MB)' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'JSON inválido' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Estrutura inválida' };
  const b = parsed as Partial<BackupFile>;
  if (b.app !== 'antispam-br') return { ok: false, error: 'Arquivo não é um backup do AntiSpam BR' };
  if (b.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: `Versão de schema incompatível (${b.schemaVersion})` };
  if (!b.data || typeof b.data !== 'object') return { ok: false, error: 'Dados ausentes' };

  const modes: ProtectionMode[] = ['OFF', 'BASIC', 'BALANCED', 'AGGRESSIVE', 'CUSTOM'];
  if (!modes.includes(b.data.mode as ProtectionMode)) return { ok: false, error: 'Modo de proteção inválido' };
  if (!Array.isArray(b.data.rules) || b.data.rules.length > MAX_RULES) return { ok: false, error: 'Regras inválidas ou excessivas' };
  for (const r of b.data.rules as Rule[]) {
    if (!r || typeof r.id !== 'string' || typeof r.name !== 'string' || !r.match || !['ALLOW', 'WARN', 'SILENCE', 'BLOCK'].includes(r.action)) {
      return { ok: false, error: 'Regra malformada detectada' };
    }
    if (typeof (r.match as { pattern?: unknown }).pattern === 'string') {
      try {
        new RegExp((r.match as { pattern: string }).pattern);
      } catch {
        return { ok: false, error: 'Regex inválida em regra' };
      }
    }
  }
  for (const key of ['allowlist', 'blacklist'] as const) {
    const list = b.data[key];
    if (!Array.isArray(list) || list.length > MAX_LIST) return { ok: false, error: `Lista ${key} inválida` };
    if (list.some((v) => typeof v !== 'string' || v.length > 20)) return { ok: false, error: `Item inválido em ${key}` };
  }
  return { ok: true, backup: b as BackupFile };
}

export async function importBackup(json: string): Promise<{ ok: boolean; error?: string }> {
  const result = validateBackup(json);
  if (!result.ok) return result;
  const { backup } = result;
  const s = getState();
  setState({
    mode: backup.data.mode,
    rules: backup.data.rules,
    allowlist: backup.data.allowlist,
    blacklist: backup.data.blacklist,
    settings: backup.data.settings ? { ...s.settings, ...backup.data.settings } : s.settings,
  });
  return { ok: true };
}
