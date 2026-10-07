/**
 * Testes do pipeline M2 (CallScreeningService real).
 * Cobre: evento nativo → ingestIncomingCall (fonte única que responde ao nativo)
 * e fail-safes do handler (número vazio, presentation inválida → sem lançar).
 */
const mockNotify = jest.fn(async (..._args: unknown[]) => {});

jest.mock('../src/services/nativeBridge', () => ({
  isNativeScreeningAvailable: jest.fn(() => true),
  isCallScreeningRoleHeld: jest.fn(async () => false),
  isCallScreeningRoleAvailable: jest.fn(async () => false),
  requestCallScreeningRole: jest.fn(async () => false),
  openCallScreeningSettings: jest.fn(async () => {}),
  notifyNativeDecision: (...args: unknown[]) => mockNotify(...args),
  installIncomingCallListener: jest.fn(),
}));

jest.mock('../src/services/notifications', () => ({
  getNotifications: () => null,
  getDefaultExpoNotificationBehavior: async () => {},
  requestNotificationPermission: async () => false,
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: jest.fn(async (k: string) => {
        store.delete(k);
      }),
    },
  };
});

import { handleIncomingCallEvent } from '../src/services/nativeBridgeEvents';
import { ingestIncomingCall, ensureDb, getDb } from '../src/services/screening';
import { getState } from '../src/services/store';
import { seedDatabase } from '../src/core/database/seed';

function resetDb(): void {
  const db = getDb();
  db.resetForTests();
  for (const e of seedDatabase()) db.upsert(e);
}

describe('pipeline de chamada recebida (M2)', () => {
  beforeAll(async () => {
    await ensureDb();
  });

  beforeEach(() => {
    mockNotify.mockClear();
    resetDb();
  });

  test('número da base com score alto → BLOCK devolvido ao nativo', async () => {
    await handleIncomingCallEvent({ number: '+551140028922' });

    expect(mockNotify).toHaveBeenCalledWith('+551140028922', 'BLOCK');
  });

  test('emergência 190 → sempre ALLOW (nunca bloqueia)', async () => {
    await handleIncomingCallEvent({ number: '190' });

    expect(mockNotify).toHaveBeenCalledWith('190', 'ALLOW');
  });

  test('número desconhecido → decisão explicável devolvida (sem lançar)', async () => {
    await handleIncomingCallEvent({ number: '+5511999990000' });

    expect(mockNotify).toHaveBeenCalledTimes(1);
    const action = String(mockNotify.mock.calls[0][1]);
    expect(['ALLOW', 'WARN', 'SILENCE', 'BLOCK']).toContain(action);
  });

  test('número vazio → ALLOW fail-safe (sem lançar)', async () => {
    await handleIncomingCallEvent({ number: '' });
    await handleIncomingCallEvent({});

    expect(mockNotify).toHaveBeenCalledWith('', 'ALLOW');
    expect(mockNotify).toHaveBeenCalledTimes(2);
  });

  test('presentation inválida vira UNKNOWN e o fluxo continua', async () => {
    await handleIncomingCallEvent({ number: '190', presentation: 'HACKED' });

    expect(mockNotify).toHaveBeenCalledWith('190', 'ALLOW');
  });

  test('ingestIncomingCall real responde ao nativo com a decisão', async () => {
    await ingestIncomingCall(
      { rawNumber: '+551140028922', at: new Date(), presentation: 'ALLOWED', contactName: null, stirShaken: 'UNKNOWN' },
      false,
    );

    expect(mockNotify).toHaveBeenCalledWith('+551140028922', 'BLOCK');
  });

  test('ingestIncomingCall simulada NÃO responde ao nativo', async () => {
    await ingestIncomingCall(
      { rawNumber: '+551140028922', at: new Date(), presentation: 'ALLOWED', contactName: null, stirShaken: 'UNKNOWN' },
      true,
    );

    expect(mockNotify).not.toHaveBeenCalled();
  });
});
