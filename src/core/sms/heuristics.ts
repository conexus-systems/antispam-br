/**
 * Heurísticas de texto do SMS Scam Engine (M4).
 * Tudo local; nada sai do dispositivo (privacy-first).
 */
import type { SmsScamCategory, SmsSignalReason } from './types';

export interface TextSignal {
  signal: SmsSignalReason;
  points: number;
  category?: SmsScamCategory;
  explanation: string;
}

/** Regex de chave PIX: CPF/CNPJ, e-mail, telefone, UUID (aleatória). */
const PIX_KEY_REGEX =
  /(?:chave\s*(?:pix|do\s*pix)|pix\s*(?:de|para)\s*(?:[a-z]+\s+)?\d{3})/i;
const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const UUID_REGEX = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

/** Código de barras de boleto: 47 dígitos (ou 44 + formatação). */
const BOLETO_REGEX = /\b\d{5}[.\s]?\d{5}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d{5}[.\s]?\d{6}\b/;

/** Marcas bancárias frequentemente impersonadas. */
const BANK_BRANDS: readonly string[] = [
  'nubank', 'itau', 'itaú', 'bradesco', 'banco do brasil', 'bancodobrasil',
  'caixa', 'caixa econômica', 'santander', 'banco inter', 'c6 bank', 'original',
  'pagbank', 'picpay', 'mercadopago', 'mercadolivre', ' Mercado Pago',
];

/** Urgência artificial (pressão de tempo). Sem acentos para pegar texto de SMS sem acentuação. */
const URGENCY_REGEX =
  /\b(?:urgente|imediatamente|ultima\s*chance|ultimo\s*aviso|hoje\s*ate|nas\s*proximas\s*horas?|em\s*\d{1,2}\s*(?:minutos?|horas?)|conta\s*(?:sera|será)\s*bloqueada|acesso\s*suspenso|evite\s*o\s*bloqueio|e\s*urgente|é\s*urgente)\b/i;

/** Pedido de senha/dados sensíveis. */
const PASSWORD_REGEX =
  /\b(?:senha|sua\s*password|dados\s*da\s*sua\s*conta|confirme\s*seus\s*dados|atualize\s*seu\s*cadastro|cadastro\s*atualizado)\b/i;

/** Pedido de código OTP (o golpe do código de verificação). */
const OTP_REGEX =
  /\b(?:codigo\s*de\s*verificacao|código\s*de\s*verificação|codigo\s*recebido|informe\s*o\s*codigo|digite\s*o\s*codigo|me\s*passe\s*o\s*codigo|otp)\b/i;

/** Remetentes legítimos conhecidos de OTP (não são SCAM sozinhos). */
const LEGIT_OTP_SENDERS: ReadonlySet<string> = new Set([
  'google', 'whatsapp', 'telegram', 'nubank', 'itau', 'caixa', 'bradesco',
  'santander', 'inter', 'picpay', 'mercadolivre', 'amazon', 'govbr', 'gov.br',
]);

/** Pressão financeira direta. */
const MONEY_REGEX =
  /\b(?:pix|reembolso|restituicao|restituição|premio|prêmio|sorteio|emprestimo\s*aprovado|empréstimo\s*aprovado|credito\s*aprovado|crédito\s*aprovado|multa|debito|débito|fatura\s*(?:atrasada|vencida)|regularize|taxa\s*de\s*(?:envio|liberacao|liberação))\b/i;

/** Falsa entrega. */
const DELIVERY_REGEX =
  /\b(?:sua\s*(?:encomenda|entrega|pacote)|encomenda\s*parou|correios?\s*(?:pacote|taxa)|taxa\s*de\s*(?:entrega|liberacao|liberação)|alfandega|alfândega|liberar\s*a\s*(?:entrega|encomenda)|reagendar\s*a\s*entrega)\b/i;

/** Falso suporte/central. */
const SUPPORT_REGEX =
  /\b(?:central\s*de\s*atendimento|suporte\s*(?:tecnico|técnico|ao\s*cliente)|ligue\s*para|ligamos\s*para\s*você|atendimento\s*(?:ao\s*cliente|exclusivo))\b/i;

/** Coleta de CPF (harvesting de dados). */
const CPF_REQUEST_REGEX =
  /\b(?:cadastre\s*(?:seu\s*)?(?:o\s*)?cpf|informe\s*seu\s*cpf|confirme\s*(?:seu|o)\s*cpf|cpf\s*para\s*(?:receber|cadastrar))\b/i;

/** SMS de marketing/telemarketing (promoção comercial não solicitada). */
const MARKETING_REGEX =
  /\b(?:oferta\s*exclusiva|promo(?:ç|c)(?:ã|a)o|promocao|contrate\s*(?:hoje|agora)|plano\s*(?:de|a\s*partir)|desconto\s*exclusivo|assine\s*(?:ja|agora)|apenas\s*r\$)\b/i;

export function analyzeTextSignals(body: string): TextSignal[] {
  const signals: TextSignal[] = [];
  const text = body.normalize('NFKC');
  const lower = text.toLowerCase();

  // PIX
  if (PIX_KEY_REGEX.test(text) || (lower.includes('pix') && (CPF_REGEX.test(text) || UUID_REGEX.test(text)))) {
    signals.push({
      signal: 'PIX_KEY',
      points: 30,
      category: 'PIX_SCAM',
      explanation: 'Mensagem envolve chave PIX (CPF/aleatória) — padrão comum de falso PIX',
    });
  }

  // Boleto
  if (BOLETO_REGEX.test(text)) {
    signals.push({
      signal: 'BOLETO_CODE',
      points: 25,
      category: 'PHISHING',
      explanation: 'Contém código de barras de boleto — risco de boleto falso',
    });
  }

  // Impersonação bancária
  const bankMentioned = BANK_BRANDS.find((b) => lower.includes(b.toLowerCase().trim()));
  const asksSensitive = PASSWORD_REGEX.test(text) || URGENCY_REGEX.test(text);
  if (bankMentioned && asksSensitive) {
    signals.push({
      signal: 'BANK_IMPERSONATION',
      points: 30,
      category: 'BANK_SCAM',
      explanation: `Cita "${bankMentioned.trim()}" com pedido de dados ou urgência — padrão de falso banco`,
    });
  }

  // Falsa entrega
  if (DELIVERY_REGEX.test(text) && (MONEY_REGEX.test(lower) || URGENCY_REGEX.test(text))) {
    signals.push({
      signal: 'DELIVERY_FEE',
      points: 25,
      category: 'DELIVERY_SCAM',
      explanation: 'Fala de entrega/encomenda com taxa ou urgência — padrão de falso Correios/entrega',
    });
  }

  // Falso suporte
  if (SUPPORT_REGEX.test(text) && URGENCY_REGEX.test(text)) {
    signals.push({
      signal: 'FAKE_SUPPORT',
      points: 20,
      category: 'FAKE_SUPPORT',
      explanation: 'Falsa central de atendimento com urgência',
    });
  }

  // Urgência isolada (mais fraca)
  if (URGENCY_REGEX.test(text) && !signals.some((s) => s.signal === 'BANK_IMPERSONATION' || s.signal === 'DELIVERY_FEE')) {
    signals.push({
      signal: 'URGENCY',
      points: 15,
      explanation: 'Urgência artificial (pressão de tempo) — técnica de engenharia social',
    });
  }

  // Pedido de senha
  if (PASSWORD_REGEX.test(text)) {
    signals.push({
      signal: 'PASSWORD_REQUEST',
      points: 25,
      explanation: 'Pede confirmação de senha/dados da conta',
    });
  }

  // Pedido de código OTP
  if (OTP_REGEX.test(text)) {
    signals.push({
      signal: 'OTP_REQUEST',
      points: 25,
      explanation: 'Pede um código de verificação — golpe do código (clonagem de WhatsApp/conta)',
    });
  }

  // Pressão financeira isolada
  if (MONEY_REGEX.test(lower) && !signals.length) {
    signals.push({
      signal: 'MONEY_PRESSURE',
      points: 12,
      explanation: 'Pressão financeira (prêmio, multa, fatura) sem contexto claro',
    });
  }

  // Coleta de CPF
  if (CPF_REQUEST_REGEX.test(text)) {
    signals.push({
      signal: 'PASSWORD_REQUEST',
      points: 15,
      explanation: 'Pede cadastro/confirmação de CPF — harvesting de dados',
    });
  }

  // Marketing/telemarketing
  if (MARKETING_REGEX.test(text)) {
    signals.push({
      signal: 'MONEY_PRESSURE',
      points: 15,
      explanation: 'Conteúdo promocional/telemarketing não solicitado',
    });
  }

  return signals;
}

/** Remetente é um short code numérico (típico de campanhas de SMS em massa). */
export function isShortCodeSender(sender: string | null | undefined): boolean {
  if (!sender) return true;
  const s = sender.trim();
  return /^\d{1,6}$/.test(s);
}

/** OTP de remetente legítimo reduz o score (não zera: pode ser phishing que finge ser o remetente). */
export function isLegitOtpSender(sender: string | null | undefined): boolean {
  if (!sender) return false;
  return LEGIT_OTP_SENDERS.has(sender.toLowerCase().trim());
}
