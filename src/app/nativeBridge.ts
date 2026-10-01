/**
 * Ponte com o módulo nativo de screening.
 *
 * Em Expo Go `NativeModules.AntiSpamScreening` NÃO existe → funções viram no-op
 * e o app opera com o simulador. Em development build (prebuild/EAS), os arquivos
 * de native/android/ registram o módulo e o CallScreeningService real assume.
 */
import { NativeModules, Platform } from 'react-native';
import type { CallAction } from '../core/types';

interface AntiSpamScreeningNative {
  isRoleHeld(): Promise<boolean>;
  requestRole(): Promise<boolean>;
  openRoleSettings(): Promise<void>;
  notifyDecision(number: string, action: CallAction): Promise<void>;
  /** No futuro: evento nativo com a chamada recebida → ingestIncomingCall(). */
}

const native = NativeModules.AntiSpamScreening as AntiSpamScreeningNative | undefined;

export function isNativeScreeningAvailable(): boolean {
  return Platform.OS === 'android' && !!native;
}

export async function isCallScreeningRoleHeld(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.isRoleHeld();
  } catch {
    return false;
  }
}

export async function requestCallScreeningRole(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.requestRole();
  } catch {
    return false;
  }
}

export async function openCallScreeningSettings(): Promise<void> {
  if (!native) return;
  try {
    await native.openRoleSettings();
  } catch {
    /* ignore */
  }
}

export async function notifyNativeDecision(number: string, action: CallAction): Promise<void> {
  if (!native) return;
  try {
    await native.notifyDecision(number, action);
  } catch {
    /* ignore */
  }
}
