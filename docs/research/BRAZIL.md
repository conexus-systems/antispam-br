# BRAZIL — Contexto de telecom e fraudes

> Fontes: regulamentação Anatel, portarias de telemarketing, programa Origem Verificada, notícias de fraudes
> recorrentes no Brasil. Resumo operacional para orientar regras, categorias e datasets.

## 1. Regras de numeração e sinalizações (base para `BrazilRules`)

| Sinalização | Significado | Tratamento no app |
|---|---|---|
| `0303` | Telemarketing regulado (contagem do "Não Me Perturbe"; chamada legítima de telemarketing, mas indesejada para muitos) | Categoria TELEMARKETING; nunca BLOCK automático por padrão — WARN/SILENCE configurável |
| `0800` | Chamada gratuita (empresa) | Neutro: legítimo ou golpe ("falso banco usa 0800 spoofado"); decide score |
| `3003` / `4004` | Centrais de atendimento corporativas (não gratuitas) | FAKE_SUPPORT quando houver denúncias; legitimo se contato do usuário |
| `0500` | Serviços de doação/pagamento por telefone | Bloqueio só com denúncias; risco de golpe de doação falsa |
| `+55` seguido de 9 dígitos iniciando em 6–5 | Padrão mobile BR (9º dígito) | Validação de formato em `normalize` |
| Números curtos (ex.: 4 dígitos) | Emergências e serviços (190, 192, 193, 180, 100, 180 etc.) | **Nunca bloquear** — hard-coded em `emergency.ts` |
| DDI estrangeiro em chamada local | Spoofing comum ("+1 (555)...") | Sinal de risco no score (SPOOFING) |

## 2. Programas e fontes regulatórias

| Fonte | O que é | Uso no projeto |
|---|---|---|
| **Origem Verificada (Anatel/ABR Telecom)** | Assinatura criptográfica da operadora atestando que o número não foi spoofado | Quando disponível ao app (Android expõe sinal de verificação em alguns casos), entra como sinal positivo no score; tratado como opcional |
| **Não Me Perturbe (nmp.org.br)** | Registro nacional para bloqueio de telemarketing (consumidor cadastra o próprio número) | Não é base redistribuível — usamos como referência conceitual; integração real exigiria API/autorização |
| **Qual Empresa Me Ligou** (sites agregadores) | Bases colaborativas de identificação | **Não redistribuível**; termo de uso proíbe scraping — apenas referência |
| **Anatel — Chamadas abusivas** | Regulamentação de telemarketing e obrigações das operadoras | Base para categorias e thresholds (ex.: TELEMARKETING não é crime, é indesejado) |

## 3. Tipos de golpe telefônico recorrentes no Brasil (mapa de categorias)

| Golpe | Padrão típico | Categoria |
|---|---|---|
| Falso PIX | "Você recebeu um PIX, confirme aqui" / cobrança via PIX de desconhecido | PIX_SCAM |
| Falso banco / central | Ligação de "gerente", pede confirmação de dados/ token | BANK_SCAM / FAKE_SUPPORT |
| Falsa entrega | "Sua encomenda parou na alfândega, pague taxa" (SMS com link) | DELIVERY_SCAM |
| Boleto falso | "Seu boleto venceu", com código de barras alterado | PHISHING |
| Empréstimo pré-aprovado | Oferta agressiva, pressão de urgência | LOAN |
| Falsa central de operadora | "Sua linha será bloqueada" | FAKE_SUPPORT |
| Recolha por cobrança | Cobrança de dívida com ameaça (prática abusiva) | COLLECTION |
| Golpe do falso contratador | "Sua conta de luz está em atraso, pague via PIX" | PIX_SCAM |
| Clonagem de WhatsApp | SMS/call pedindo código de verificação | PHISHING |
| Robocall de "pesquisa" | IVR encadeando para oferta | SURVEY / ROBOCALL |

## 4. Padrões técnicos BR que alimentam o motor

- **DDDs**: 11–99 com regras de dígito 9; DDDs de capital vs interior não discriminam spam (não usar como sinal negativo).
- **Portabilidade numérica**: número portado mantém DDD de origem — não inferir operadora pelo prefixo (evitar regra errada).
- **Spoofing**: número real de vítima usado como origem (callback harassa terceiro) — por isso contestação (LEGITIMATE) é um fluxo de primeira classe.
- **Robocalls em massa por prefixo**: CampaignDetector agrupa denúncias por prefixo/janela temporal → detecta campanha mesmo sem denúncia individual suficiente.

## 5. LGPD na prática (resumo aplicado)

- Dados pessoais tratados: **apenas número (hashed quando remoto) + metadados de denúncia opt-in**.
- Base de direitos: consentimento (opt-in) e legítimo interesse (proteção do próprio dispositivo, processado localmente).
- **Não** coletar: agenda, histórico completo de chamadas, conteúdo de SMS além do analisado localmente, identificadores de publicidade.
- Direitos do titular: exclusão de denúncias por número (endpoint de opt-out), anonimização agregada para datasets.
- Transferência internacional: datasets públicos contêm apenas dados agregados/anonimizados.
