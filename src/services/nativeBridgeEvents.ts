import { notifyNativeDecision } from './nativeBridge';
import { ingestIncomingCall } from './screening';

export interface IncomingCallPayload {
  number?: string;
  presentation?: string;
}

/**
 * Fluxo de uma chamada recebida vinda do nativo.
 *
 * A decisão volta ao nativo DENTRO de ingestIncomingCall() (fonte única — evita
 * dupla publicação). Este handler só cobre os caminhos de fail-safe:
 * pipeline ausente/lançando → ALLOW, para o telefone nunca ficar sem resposta.
 */
export async function handleIncomingCallEvent(event: IncomingCallPayload): Promise<void> {
  const number = typeof event?.number === 'string' ? event.number : '';
  const presentation =
    event?.presentation === 'ALLOWED' || event?.presentation === 'PAYPHONE' || event?.presentation === 'RESTRICTED'
      ? event.presentation
      : 'UNKNOWN';

  try {
    const decision = await ingestIncomingCall(
      {
        rawNumber: number,
        presentation,
        contactName: null,
        stirShaken: 'UNKNOWN',
        at: new Date(),
      },
      false,
    );
    if (!decision) {
      await notifyNativeDecision(number, 'ALLOW');
    }
  } catch {
    await notifyNativeDecision(number, 'ALLOW').catch(() => {});
  }
}
