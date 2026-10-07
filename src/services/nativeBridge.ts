/**
 * Ponte com o módulo nativo de screening (M2).
 *
 * Expo Go: `requireNativeModule('AntiSpamScreening')` lança → funções viram no-op
 * e o app opera com o simulador. Development build: módulo Expo local registrado,
 * CallScreeningService real assume e o evento onIncomingCall alimenta o pipeline.
 *
 * CONTRATO: a decisão volta ao nativo UMA vez, por ingestIncomingCall()
 * (src/services/screening.ts). Este módulo só expõe primitivas.
 */
import { Platform } from 'react-native';
import type { CallAction } from '../core/types';

/** Contrato do módulo nativo `AntiSpamScreening`. */
interface AntiSpamScreeningNative {
  isRoleHeld(): Promise<boolean>;
  isRoleAvailable(): Promise<boolean>;
  requestRole(): Promise<boolean>;
  openRoleSettings(): Promise<void>;
  notifyDecision(number: string, action: CallAction): Promise<void>;
  addListener?: (eventName: string, listener: (event: { number?: string; presentation?: string }) => void) => void;
  removeListeners?: (count: number) => void;
}

const moduleCache: { value: AntiSpamScreeningNative | null; resolved: boolean } = {
  value: null,
  resolved: false,
};

/**
 * Acesso LAZY ao módulo nativo. Em Expo Go o require falha — trato como ausência
 * (mesma estratégia defensiva de src/services/notifications.ts).
 */
function getNative(): AntiSpamScreeningNative | null {
  if (Platform.OS !== 'android') return null;
  if (moduleCache.resolved) return moduleCache.value;
  moduleCache.resolved = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require('expo-modules-core') as {
      requireNativeModule: (name: string) => AntiSpamScreeningNative;
    };
    moduleCache.value = requireNativeModule('AntiSpamScreening');
  } catch {
    moduleCache.value = null;
  }
  return moduleCache.value;
}

export function isNativeScreeningAvailable(): boolean {
  return Platform.OS === 'android' && getNative() !== null;
}

export async function isCallScreeningRoleHeld(): Promise<boolean> {
  const native = getNative();
  if (!native) return false;
  try {
    return await native.isRoleHeld();
  } catch {
    return false;
  }
}

export async function isCallScreeningRoleAvailable(): Promise<boolean> {
  const native = getNative();
  if (!native) return false;
  try {
    return await native.isRoleAvailable();
  } catch {
    return false;
  }
}

export async function requestCallScreeningRole(): Promise<boolean> {
  const native = getNative();
  if (!native) return false;
  try {
    return await native.requestRole();
  } catch {
    return false;
  }
}

export async function openCallScreeningSettings(): Promise<void> {
  const native = getNative();
  if (!native) return;
  try {
    await native.openRoleSettings();
  } catch {
    /* ignore */
  }
}

export async function notifyNativeDecision(number: string, action: CallAction): Promise<void> {
  const native = getNative();
  if (!native) return;
  try {
    await native.notifyDecision(number, action);
  } catch {
    /* ignore */
  }
}

let pipelineInstalled = false;

/**
 * Instala o listener do evento nativo `onIncomingCall` (idempotente).
 * O handler vive em nativeBridgeEvents.ts (import lazy evita ciclo de módulos).
 */
export function installIncomingCallListener(): void {
  const native = getNative();
  if (!native || pipelineInstalled || typeof native.addListener !== 'function') return;
  pipelineInstalled = true;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { handleIncomingCallEvent } = require('./nativeBridgeEvents') as {
    handleIncomingCallEvent: (event: { number?: string; presentation?: string }) => Promise<void>;
  };
  native.addListener('onIncomingCall', (event) => {
    void handleIncomingCallEvent(event);
  });
}
