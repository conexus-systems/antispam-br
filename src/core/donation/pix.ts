/**
 * PIX Copia e Cola — gerador BR Code (EMV QR Code MPM) com CRC16-CCITT.
 * Padrão do Banco Central do Brasil (Pix).
 *
 * SEGURANÇA: a chave NUNCA vai no código-fonte. Vem de EXPO_PUBLIC_DONATION_PIX_KEY
 * (env de build) ou da configuração do app. Sem chave configurada, a tela de doação
 * mostra apenas o aviso de como configurar.
 */
import * as Application from 'expo-application';

/** EMV field: id (2) + len (2) + value. */
function field(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PixPayloadParams {
  /** Chave PIX (CPF/CNPJ/e-mail/telefone/aleatória). */
  key: string;
  /** Nome do recebedor (máx 25). */
  merchantName: string;
  /** Cidade (máx 15). */
  merchantCity: string;
  /** Valor em reais (opcional). */
  amount?: number;
  /** Descrição/txid (opcional, máx 25). */
  txid?: string;
}

export function buildPixPayload({ key, merchantName, merchantCity, amount, txid }: PixPayloadParams): string {
  const gui = field('00', 'br.gov.bcb.pix');
  const keyField = field('01', key);
  const merchantAccount = field('26', gui + keyField);

  const parts: string[] = [
    field('00', '01'), // payload format
    field('01', '12'), // point of initiation: 12 = transação única (com valor)
    merchantAccount,
    field('52', '0000'),
    field('53', '986'), // BRL
  ];
  if (amount && amount > 0) parts.push(field('54', amount.toFixed(2)));
  parts.push(field('58', 'BR'));
  parts.push(field('59', (merchantName || 'AntiSpam BR').slice(0, 25)));
  parts.push(field('60', (merchantCity || 'BRASIL').slice(0, 15)));
  parts.push(field('62', field('05', (txid || '***').slice(0, 25))));
  parts.push('6304');

  const partial = parts.join('');
  return partial + crc16(partial);
}

export function appVersion(): string {
  try {
    return Application.nativeApplicationVersion ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}
