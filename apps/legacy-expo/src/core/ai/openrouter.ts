/**
 * Cliente OpenRouter — camada OPCIONAL de "IA Assistente".
 *
 * REGRAS (críticas):
 * 1. NUNCA usada na decisão de bloqueio (screening é local, < 100 ms, offline).
 * 2. DESLIGADA por padrão; usuário ativa e fornece a própria chave (fica só no aparelho).
 * 3. Só envia o número/marcações que o usuário pediu para analisar — nunca contatos, histórico ou agenda.
 * 4. Toda resposta é meramente informativa e rotulada como "opinião de IA".
 *
 * Modelos: usa a lista de modelos gratuitos do OpenRouter quando nenhuma preferência é dada.
 */
const BASE_URL = 'https://openrouter.ai/api/v1';

export const FREE_MODELS = [
  'deepseek/deepseek-chat-v3.1:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen-2.5-72b-instruct:free',
] as const;

export const DEFAULT_MODEL = FREE_MODELS[0];

export interface AiConfig {
  apiKey: string;
  model?: string;
}

export interface AiInsight {
  verdict: string;
  riskLevel: 'baixo' | 'médio' | 'alto';
  reasoning: string[];
  advice: string[];
  raw?: string;
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Resposta da IA sem JSON');
  return JSON.parse(match[0]);
}

export async function analyzeNumber(
  cfg: AiConfig,
  params: {
    number: string;
    kind: string;
    ddd?: string;
    localScore: number;
    localReasons: string[];
  },
): Promise<AiInsight> {
  const model = cfg.model || DEFAULT_MODEL;
  const system =
    'Você é um analista de segurança telefônica do Brasil. Responda APENAS com JSON válido ' +
    'no formato {"verdict": string, "riskLevel": "baixo"|"médio"|"alto", "reasoning": string[], "advice": string[]}. ' +
    'Considere padrões de golpe conhecidos no Brasil (falso Pix, falsa central bancária, falso entregador, ' +
    'golpe do boleto, porteiro eletrônico falso, recarga VIP). Seja conservador: nunca afirme que é golpe sem evidência.';
  const user = `Número: ${params.number} (tipo: ${params.kind}${params.ddd ? `, DDD ${params.ddd}` : ''}).\n` +
    `Score local do app: ${params.localScore}/100.\nSinais locais: ${params.localReasons.join('; ') || 'nenhum'}.\n` +
    `Dê sua análise (não invente dados sobre este número específico; raciocine pelos padrões).`;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
      'X-Title': 'AntiSpam BR',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  const parsed = extractJson(content) as Partial<AiInsight>;

  return {
    verdict: String(parsed.verdict ?? 'Análise indisponível'),
    riskLevel: (['baixo', 'médio', 'alto'] as const).includes(parsed.riskLevel as never)
      ? (parsed.riskLevel as AiInsight['riskLevel'])
      : 'médio',
    reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.map(String).slice(0, 6) : [],
    advice: Array.isArray(parsed.advice) ? parsed.advice.map(String).slice(0, 6) : [],
    raw: content,
  };
}
