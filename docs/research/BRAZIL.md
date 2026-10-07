# BRAZIL — Telecom, regulação e fraudes telefônicas (pesquisa)

> Autor: BRAZIL_TELECOM_AGENT · Acesso a todas as fontes: **2026-10-07** · Status: pesquisa, não é parecer jurídico.
> Convenção: **[V]** = verificado em fonte oficial/primária citada; **[I]** = imprensa especializada; **[NV]** = não verificado.
> Fatos de numeração legíveis por máquina: [`data/rules/brazil-numbering.json`](../../data/rules/brazil-numbering.json).
> Avaliação de fontes de dados: [`docs/BRAZIL_DATA_SOURCES.md`](../BRAZIL_DATA_SOURCES.md).

## 0. Resumo para o motor (o que muda o código)

| Fato | Status | Impacto |
|---|---|---|
| 0303 é **facultativo** desde 15/08/2025 (Acórdão nº 201/2025) | [V] | 0303 identifica quem *escolheu* se identificar; ausência de 0303 não prova nada |
| 0303 cobre telemarketing **e** cobrança, doações e "outros" volumes intensos | [V] | Rótulo "telemarketing" é estreito demais; usar "chamada em massa identificada" |
| 0303 **não** é número de valor adicionado (é tarifa compartilhada) | [V] | Corrigir `kind: 'premium'` / risco 85 em `brazilRules.ts` |
| 0304 (cobrança) foi **revogado** antes de entrar em operação (25/04/2024) | [V] | Não criar regra 0304 |
| 0900 está **suspenso** (códigos em reserva técnica) | [V] | Chamada de 0900 hoje é anômala |
| 67 DDDs; lista exata confirmada | [V] | Validar DDD por lista, não por faixa 11–99 |
| Celular: 9 dígitos, N9 ∈ {7,8,9} pela norma, na prática sempre 9 | [V] | Manter regra "começa com 9"; não rejeitar 7/8 com dureza no futuro |
| Fixo: 8 dígitos, N8 ∈ {2..6} | [V] | `normalize.ts` usa 2–5 (falta 6) |
| PRF = **191**; **195** = SABESP (só SP); 188 = Linha da Vida (CVV) | [V] | `emergency.ts` tem 195 como PRF e não tem 191/188 |
| Autenticação obrigatória para > 500 mil chamadas/mês (desde nov/2025); universal até 2028 | [V] | Selo "Número Validado" vira sinal positivo forte |
| Bloqueio de 15 dias para PJ com ≥ 100 mil chamadas/dia e ≥ 85% curtas (≤ 6 s) | [V] | Robocall "prova de vida" é padrão conhecido; janela de 6 s útil como heurística |

## 1. Plano de numeração (Regulamento Geral de Numeração)

Base: **Resolução Anatel nº 749, de 15/03/2022** (Regulamento Geral de Numeração), com o Plano Geral de Códigos
Nacionais (PGCN) tratado em ato separado (Res. 755/2022; PGCN atual aprovado pelo Despacho Decisório
nº 17/2025/PRRE/SPR, de 10/11/2025). [V]
Fonte: https://informacoes.anatel.gov.br/legislacao/resolucoes/2022/1641-resolucao-749

### 1.1 Estrutura (Res. 749/2022, arts. 10–18) [V]

| Elemento | Formato | Observação |
|---|---|---|
| Código do País | `55` | UIT |
| Código Nacional (CN, "DDD") | 2 dígitos, N2 e N1 de 1 a 9 | 67 em uso |
| Código de acesso fixo (STFC/SCM) | 8 dígitos, **N8 = 2 a 6** | art. 11 |
| Código de acesso móvel (SMP) | 9 dígitos, **N9 = 7, 8 ou 9** | art. 12; `700` = satélite (SMGS) |
| Serviço de Utilidade Pública (SUP) | 3 dígitos `1XX` | art. 13–14; uso exclusivo da função (§1º) |
| Código Não Geográfico (CNG) | `0` + 10 dígitos (`0XXX ABC MCDU`) | art. 18 e art. 28 |
| Código de Seleção de Prestadora (CSP) | 2 dígitos | longa distância: `0 + CSP + CN + número` |
| Prefixo nacional / internacional | `0` / `00` | art. 10 VII–VIII |
| Chamada a cobrar | `90` (LD) / `9090` (local) | art. 10 IX e art. 20 |

Formas que o normalizador deve aceitar como o mesmo número móvel `+55 11 9XXXX-XXXX`:
`11 9XXXXXXXX`, `0 11 9XXXXXXXX`, `0 CSP 11 9XXXXXXXX` (ex.: `0 15 11 9…`, `0 21 11 9…`),
`+55 11 9…`, `0055 11 9…` [NV para `0055`: não testado no código], e chamadas a cobrar `90 CSP 11 9…`
(hoje o normalizador **não** trata o prefixo `90`).

### 1.2 Nono dígito [V]

O SMP usa 9 dígitos com identificador N9 ∈ {7, 8, 9} (Res. 749 art. 12). A migração do 9º dígito terminou
em 2016 [NV — data não relida em fonte primária nesta pesquisa]; na prática **todo celular brasileiro
ativo começa com 9**. Os dígitos 7 e 8 estão destinados ao SMP mas sem uso massivo verificado.
Consequência: `mobile_first_digits: ["9"]` como regra operacional, com `["7","8","9"]` registrado como
destinação regulatória.

### 1.3 DDDs (Códigos Nacionais) [V]

São **67** áreas de numeração (Anatel, FAQ Áreas Tarifárias; MCom, ago/2026):

- SP: 11–19 · RJ: 21, 22, 24 · ES: 27, 28 · MG: 31–35, 37, 38
- PR: 41–46 · SC: 47–49 · RS: 51, 53, 54, 55
- DF/GO: 61 (DF + entorno goiano) · GO: 62, 64 · TO: 63 · MT: 65, 66 · MS: 67 · AC: 68 · RO: 69
- BA: 71, 73, 74, 75, 77 · SE: 79 · PE: 81, 87 · AL: 82 · PB: 83 · RN: 84 · CE: 85, 88 · PI: 86, 89
- PA: 91, 93, 94 · AM: 92, 97 · RR: 95 · AP: 96 · MA: 98, 99

**Não existem** (inválidos): 20, 23, 25, 26, 29, 30, 36, 39, 40, 50, 52, 56–60, 70, 72, 76, 78, 80, 90.
Fontes: https://www.gov.br/mcom/pt-br/noticias/noticias_alt/2026/agosto/saiba-a-importancia-da-discagem-direta-a-distancia-ddd ·
painel município→DDD: https://informacoes.anatel.gov.br/paineis/areas-tarifarias/codigos-nacionais

**Novas Áreas Locais do STFC (2026)** [V]: a área local da telefonia fixa passou a coincidir com a área do
DDD (de 4.118 para 67 áreas), em 9 etapas de 11/01/2026 (71–79) a 21/06/2026 (11–19), Acórdão nº 202/2025.
Efeito para o app: chamadas fixas intra-DDD podem chegar **sem DDD** no identificador (8 dígitos); o
normalizador deve completar com o DDD do aparelho quando conhecido, em vez de classificar como "desconhecido".
Fonte: https://www.gov.br/anatel/pt-br/assuntos/noticias/implementacao-das-novas-areas-locais-da-telefonia-fixa-comeca-em-janeiro-com-reducao-de-4-118-para-67-areas

### 1.4 Códigos Não Geográficos (CNG) [V]

| Prefixo | Destinação (Res. 749 art. 18) | Quem paga | Status |
|---|---|---|---|
| `0800` | Chamada franqueada; assinante paga tudo | assinante | ativo |
| `0300` | Tarifa compartilhada | originador + assinante | ativo (reserva via nSAPN) |
| `0303` | Tarifa compartilhada, assinante com **volume intenso de chamadas** | originador + assinante | ativo, **uso facultativo** |
| `0500` | Doações a entidades sem fins lucrativos; os 2 últimos dígitos = valor em R$ | originador (+ doação) | ativo |
| `0900` | Serviço de valor adicionado | originador (+ adicional) | **suspenso**, reserva técnica |

Formato total discado: **11 dígitos** (`0` + `XXX` + 7). Portabilidade de CNG existe desde 01/09/2008.
Fontes: https://www.gov.br/anatel/pt-br/regulado/numeracao/codigos-nacionais/codigos-nao-geograficos ·
https://www.gov.br/anatel/pt-br/regulado/numeracao/perguntas-frequentes

**Números Únicos Nacionais (3003, 4003, 4004, 4020…)** [NV como norma]: são códigos de 8 dígitos marcados
sem DDD com tarifa local, vendidos como "NUN" por operadoras. Não localizei definição deles nos atos da
Anatel consultados; a descrição vem de fontes comerciais. Uso legítimo confirmado: Correios `3003-0100`
(https://www.correios.com.br/central-de-informacoes/boletim-aos-clientes/mensagens-falsas-sobre-encomendas).
`3004`, `4002`, `4024` (presentes em `normalize.ts`) **não foram confirmados**.

### 1.5 Serviços de Utilidade Pública e de Emergência (1XX) [V]

Tabela oficial da Anatel (acessada em 2026-10-07):
https://www.gov.br/anatel/pt-br/regulado/numeracao/codigos-nacionais/servicos-de-utilidade-publica-e-de-emergencia
Dataset aberto (CC-BY): https://dados.gov.br/dados/conjuntos-dados/servicos-de-utilidade-publica-e-de-apoio-a-telefonia-fixa

**Serviços públicos de emergência** (todos gratuitos): 100 Direitos Humanos · 111 Caixa (programa
emergencial) · **112/911 Polícia Militar — somente celular** · 125 Conselhos Tutelares · 128 Emergência
Mercosul (não ativado) · 132 Dependentes Químicos · 153 Guarda Municipal · 180 Central da Mulher ·
181 Disque Denúncia · 185 Marinha · **188 Linha da Vida (CVV)** · 190 PM · **191 PRF** · 192 SAMU ·
193 Bombeiros · 194 Polícia Federal · **195 SABESP (somente SP)** · 196 COVID-19 · 197 Polícia Civil ·
**198 Polícia Rodoviária Estadual** · 199 Defesa Civil.

**Demais utilidade pública** (seleção): 102 auxílio à lista · 103+ext STFC · 105+ext SMP · 115 água ·
116 energia · 117 gás · 127 MP · 129 Defensoria · 133 Anatel · 135 INSS · 136 Disque Saúde ·
138 Governo Federal · 145 Banco Central · 146 Receita Federal · 151 Procon · 154 Detran · 155 estadual ·
156 municipal · 162 Ouvidorias · 165 Disque Idoso.

Regra de produto: **todo 1XX = never_block**. O art. 14 §1º da Res. 749 proíbe uso de SUP para outra
finalidade, então o risco de spam vindo de 1XX é desprezível e o custo de bloquear um socorro é inaceitável.
Atenção: números como 135, 145 e 146 são **nomes usados em golpes** (INSS/BC/Receita), mas o golpe vem de
números comuns que *citam* essas instituições, não dos 1XX em si.

### 1.6 Códigos curtos de SMS (LA / "Large Account") [I]

A numeração de SMS A2P **não é padronizada pela Anatel**: são contratos entre operadoras e brokers, com
pouca rastreabilidade. O Acórdão nº 201/2025 mandou elaborar plano de ação para governança do SMS
(rastreabilidade ponta a ponta, autenticidade do remetente, bloqueio de adulteração); em jan/2026 a ABR
Telecom foi indicada para manter um **diretório centralizado de short codes**.
Fonte: https://teletime.com.br/20/01/2026/abr-telecom-centralizara-diretorio-de-codigos-para-sms/ ·
https://telesintese.com.br/anatel-mantem-autenticacao-de-chamadas-para-grandes-chamadores/
Comprimento: 5 dígitos é prática de mercado (ex.: 2XXXX) **[NV como norma]** — o motor não deve presumir que
remetente de 5 dígitos é legítimo nem ilegítimo; golpes de SMS usam short codes contratados legitimamente.

## 2. Chamadas abusivas e robocalls

### 2.1 Medidas cautelares (bloqueio de grandes originadores) [V]

Página oficial: https://www.gov.br/anatel/pt-br/consumidor/chamadas-abusivas/medidas-cautelares

| Ato | Vigência | Regra |
|---|---|---|
| Despacho 160/2022 e 250/2022/COGE/SCO | jun/2022 → | Bloqueio por originador com ≥ 100 mil chamadas curtas/dia; "curta" = ≤ 3 s; art. 6º do 250/2022 criou a obrigação do "Qual Empresa Me Ligou" |
| Despacho 102/2023/COGE/SCO | 27/04/2023 → abr/2024 | Identificar chamadas com numeração não autorizada/irregular (anti-spoofing) |
| **Despacho 22/2024/RCTS/SRC** (4ª cautelar) | **01/06/2024 →** | Bloqueio por **15 dias** da originação de PJ (soma de todos os CNPJs da matriz/filiais) com **≥ 100.000 chamadas/dia** e **≥ 85% curtas**; curta = não completada, caixa postal, ou completada com **≤ 6 s** |
| Despacho 30/2025 e **75/2026/RCTS/SRC** | prorrogação | Cautelar prorrogada até **31/10/2028** [I: Telesíntese] |
| Despacho 262/2024 e 325/2024/COGE/SCO; **978/2025** (alt. 26/2026) | → | Anti-spoofing: bloqueio de tráfego irregular, CDRs sob demanda, bloqueio de interconexão de prestadora que adulterar código de origem; código SMP deve estar vinculado a IMSI |
| **Despacho 787/2025/COGE/SCO** | 01/11/2025 → 31/10/2028 | **Autenticação obrigatória** para "grandes chamadores" (> 500 mil chamadas/mês por prestadora, CPF ou CNPJ matriz+filiais) |

Resultados divulgados pela Anatel [V]: > 248 bilhões de chamadas deixaram de ser feitas, > 1.200 bloqueios de
empresas e ~R$ 40 milhões em multas "nos últimos quatro anos" (página Chamadas Abusivas, 2026-10-07).
https://www.gov.br/anatel/pt-br/consumidor/chamadas-abusivas

### 2.2 Volume e "chamada muda" [V/I]

- Abr/2025: **10,22 bi** de chamadas curtas de 16,5 bi totais (61,9%); abr/2024: 11,96 bi de 23,43 bi (51%) [I: G1 citando Anatel].
- 2025: 161,16 bi de chamadas curtas, ~24,1 bi chegaram ao consumidor [I: Idec, release].
- Por que o telefone toca e ninguém fala: discadores preditivos/robôs ligam em massa para checar se o número
  está ativo, em que horário a pessoa atende e se o número é "do José ou da Maria" (Anatel, página Chamadas
  Abusivas) [V]. Isso gera a "ligação muda" de 1–6 s; quem atende é marcado como "número quente" e recebe mais.
- Implicação: **chamada que cai em ≤ 6 s sem fala** é um sinal comportamental legítimo para o
  CampaignDetector — mas apenas agregado (muitos destinatários), nunca para punir um número individual.

### 2.3 0303 — linha do tempo [V]

1. **Ato nº 10.413/2021** (fim de 2021): cria o 0303 para **telemarketing ativo**. Obrigatoriedade operacional
   a partir de mar/2022 [NV — data exata não relida no Ato].
2. **03/11/2022**: Conselho Diretor designa **0304 para cobrança** (com consulta pública e prazo de 180 dias).
   https://www.gov.br/anatel/pt-br/assuntos/noticias/anatel-aprova-designacao-do-numero-0304-para-atividades-de-cobranca
3. **25/04/2024**: após pedido de reconsideração (Fenifra, Sinterj, Conexis), Conselho **desiste do 0304** e
   determina 0303 para **todas as atividades com intenso volume de chamadas** (telemarketing, cobrança,
   doações); quem usa Stir/Shaken fica dispensado.
   https://www.gov.br/anatel/pt-br/assuntos/noticias/conselho-diretor-decide-ampliar-o-uso-do-codigo-0303-para-atividade-de-cobrancas-e-determinar-interlocucao-para-diminuir-falha-em-bases-cadastrais
4. **Ato nº 12.712/2024**: procedimento vigente; item 9: volume intenso = > 10 mil chamadas em pelo menos um
   dia do mês; 0303 em ≥ 90% das chamadas; atividade registrada no nSAPN (telemarketing ativo / cobrança /
   doação / outros); visor deve exibir `0303 N7…N1`.
   https://informacoes.anatel.gov.br/legislacao/component/content/article/154-atos-de-numeracao/2140-ato-12712
5. **Acórdão nº 201, de 14/08/2025** (DOU 15/08/2025): letra "e" torna o 0303 **facultativo**; letra "f"
   obriga autenticação para > 500 mil chamadas/mês; cobrança e filantropia podem usar só autenticação, sem
   identificação. https://www.gov.br/anatel/pt-br/regulado/numeracao/telemarketing-ativo-prefixo-0303
   Observação: o texto consolidado do Ato 12.712 (item 9) ainda traz a regra dos 10 mil/dia com a nota
   "redação dada pela letra e do Acórdão 201"; a página oficial do 0303 afirma o caráter facultativo.
   Tratar como **facultativo** e reavaliar se a Anatel publicar texto consolidado divergente.

Consequências para o produto: (a) 0303 = "chamada em massa que se identificou" (telemarketing, cobrança
ou doação), padrão WARN/"Apenas identificar", nunca BLOCK automático por padrão; (b) a opção do usuário
"Bloquear todo 0303" continua válida e popular; (c) **não** inferir legitimidade de quem não usa 0303.

## 3. Autenticação de chamadas e "Origem Verificada" [V]

- **O que é**: implementação brasileira inspirada em STIR/SHAKEN. Separa **autenticação** (validação técnica
  de que o número de origem é do chamador — anti-spoofing) de **identificação** (nome, logomarca, motivo da
  chamada e selo "Número Validado" no visor).
- **Quem opera**: Autoridade de Identificação e Autenticação (AIA), operada pela **ABR Telecom**; empresas
  contratam via prestadora participante; sem custo para quem recebe. https://origemverificada.com.br/faq
- **Obrigatoriedade**: autenticação obrigatória para grandes chamadores (> 500 mil/mês) desde nov/2025
  (Despacho 787/2025; início confirmado para 15/11/2025 após indeferimento de recursos [I: Telesíntese]);
  **universal até 2028** pela Resolução nº 777/2025 (RGST). Identificação visual segue **facultativa**.
  https://www.gov.br/anatel/pt-br/regulado/acompanhamento-e-controle/autenticacao-e-identificacao-de-chamadas
- **Adoção** [I: Mobile Time, 13/03/2026]: ~35 bi de chamadas autenticadas em 2025; 17 prestadoras SMP e
  322 STFC reportam ao menos um acesso aderente.
- **O que o usuário vê**: selo ✔ e "Número Validado"; depende de aparelho 4G/5G com VoLTE e SO atualizado.
  iOS frequentemente mostra o selo só no histórico; Android recente mostra selo + nome + logo + motivo
  [I: G1 22/10/2025; Mobile Time].
- **Para o app**: o Android expõe verificação de chamada (`Call.Details#getCallerNumberVerificationStatus`,
  Android 11+) em `CallScreeningService` [NV — confirmar com o MOBILE agent e testar com operadoras BR].
  Quando `VERIFICATION_STATUS_PASSED`, reduzir fortemente o risco de spoofing; `FAILED` é sinal forte de
  adulteração. Ausência de status **não** é negativa (adoção parcial até 2028).

## 4. Spoofing, SIM swap e clonagem

- **Spoofing** [V]: Anatel proíbe originar chamadas com código em desconformidade com o RNST e pode bloquear
  interconexões de prestadoras que adulterem a origem (Despacho 978/2025). Ainda assim ocorre, sobretudo via
  rotas internacionais/VoIP. Febraban (01/07/2026) alerta para golpistas com "recursos tecnológicos que
  simulam números oficiais" de bancos.
  https://www.gov.br/anatel/pt-br/regulado/acompanhamento-e-controle/combate-ao-spoofing ·
  https://portal.febraban.org.br/noticia/4471/pt-br/
- **Consequência de design**: um número legítimo de vítima pode receber denúncias por ter sido spoofado →
  contestação (LEGITIMATE) é fluxo de primeira classe; decaimento temporal de reputação é obrigatório.
- **SIM swap** [V/I]: criminoso convence a operadora a transferir a linha para outro chip e recebe SMS de
  verificação (WhatsApp, bancos). Sinal: perda súbita de sinal + alertas de login. Orientação: ligar para a
  operadora, bloquear o chip, BO. CTIR Gov Recomendação 05/2019; Claro (blog).
  https://www.gov.br/ctir/pt-br/centrais-de-conteudo/publicacoes/recomendacoes-pdf/2019/recomendacao_2019_05_como_agir_em_caso_de_clonagem_do_aparelho_celular.pdf
- O app **não detecta SIM swap** do próprio usuário de forma confiável; pode só educar (conteúdo).

## 5. Golpes recorrentes (mapa → categorias do motor)

Dados Febraban, 1º sem/2025 (relatos de clientes aos bancos associados) [V]:
falsa venda 174 mil (+314%) · **falsa central/falso funcionário 139 mil (+195,7%)** · golpe do WhatsApp 73 mil ·
falso investimento 21 mil · phishing 21 mil · falso boleto 9 mil · troca de cartão 8 mil · devolução de
empréstimo 4 mil · mão fantasma 3 mil · delivery 2 mil. https://portal.febraban.org.br/noticia/4381/pt-br/

| Golpe | Padrão / fato oficial | Categoria |
|---|---|---|
| Falsa central do banco | "Novo dispositivo acessou sua conta", pede senha/token/transferência/app. Bancos **nunca** pedem senha, token, transferência ou "teste de Pix" (Febraban) [V] | BANK_SCAM / FAKE_SUPPORT |
| Golpe do Pix / "Pix errado" | Pede devolução ou "teste"; vítima tem **MED**: 80 dias da transação para pedir devolução pelo app do banco; recebedor tem 80 dias (desde 01/09/2026) para contestar a devolução; recuperação média ~9,3% do contestado em 2025 [V: Guia MED BCB; I: Let's Money] | PIX_SCAM |
| Falsa taxa de importação / Correios | SMS com link para pagar "taxa", "reenvio", "encomenda retida". Receita, Correios e e-commerces **nunca** enviam link de pagamento por SMS; pagar só em "Minhas Importações" logado [V] | DELIVERY_SCAM |
| Falso INSS / prova de vida / consignado | INSS **não** envia SMS/WhatsApp sobre corte de benefício e **não** liga para prova de vida; canal: Meu INSS e 135. Benefício pode ser bloqueado para consignado no Meu INSS [V] | GOV_SCAM / LOAN |
| Falso Serasa "Limpa Nome" | Desconto urgente, taxa para "liberar acordo", pedido de código SMS. Serasa não cobra taxa e não pede senha/código; WhatsApp oficial (11) 99575-2096 [V: serasa.com.br] | PHISHING / COLLECTION |
| Falso boleto | Boleto adulterado, beneficiário estranho | PHISHING |
| Clonagem de WhatsApp | Pede "código de 6 dígitos" recebido por SMS | PHISHING |
| Telemarketing de consignado | Oferta insistente a aposentados; Não Me Perturbe cobre bancos de consignado | TELEMARKETING / LOAN |
| Robocall / ligação muda | ≤ 6 s, sem fala, prova de vida do número | ROBOCALL |

Fontes: Receita https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/manuais/remessas-postal-e-expressa/e-golpe/golpe-por-carta/golpe-por-carta ·
INSS https://www.gov.br/inss/pt-br/assuntos/noticias/inss-nao-envia-sms-para-informar-sobre-corte-de-beneficio-por-falta-de-prova-de-vida ·
BCB MED https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Guia_MED.pdf ·
Serasa https://www.serasa.com.br/limpa-nome-online/blog/golpe-serasa-limpa-nome-como-identificar/

**Conteúdo textual para o classificador de SMS (local, sem envio)**: termos de alto risco verificados nas
orientações oficiais — "taxa de reenvio", "taxa de liberação", "encomenda retida/travada/leiloada",
"prova de vida", "benefício será bloqueado/cortado", "acordo com desconto", "regularize", link encurtado +
urgência. Combinação **link + órgão público + cobrança** é o padrão mais forte.

**Não usar números oficiais de banco como allowlist automática**: (a) spoofing de números oficiais é
justamente o vetor da falsa central; (b) não há lista oficial consolidada, licenciada e mantida de
"números de SAC de bancos" (Febraban/BCB não publicam como dataset — **[NV]** de forma exaustiva); (c) a
orientação oficial é o usuário **desligar e ligar ele mesmo** para o canal do cartão/app. Allowlist só com
autenticação (Origem Verificada) ou contato salvo pelo usuário.

## 6. Ferramentas oficiais para o cidadão (o app deve linkar, não copiar)

| Ferramenta | Dono | O que faz | Uso no app |
|---|---|---|---|
| **Não Me Perturbe** (naomeperturbe.com.br) | ABR Telecom (propriedade intelectual do site); participantes: prestadoras de telecom + bancos de consignado (Febraban/ABBC) | Bloqueio de oferta de telecom (fixo, móvel, TV, internet) e de **empréstimo/cartão consignado**; efetivo em até 30 dias, válido 1 ano (consignado). **Não** cobre cobrança, confirmação de dados, prevenção a fraude, retenção | Deep link "Cadastre-se no Não Me Perturbe" |
| **Qual Empresa Me Ligou** (qualempresameligou.com.br) | Prestadoras, operado pela ABR Telecom, por determinação da Anatel (art. 6º do Despacho 250/2022) | Retorna razão social e CNPJ se o número for de PJ; CPF → "não encontrada"; CAPTCHA; atualização em até 30 dias | Botão "Consultar no site oficial" (abre navegador); **sem** consulta automatizada |
| **Consulta Número** (consultanumero.abrtelecom.com.br) | ABR Telecom (Entidade Administradora da Portabilidade) | Prestadora atual/histórico de um número | Só link |
| **Anatel Consumidor** / 1331 | Anatel | Reclamação contra prestadora | Link no fluxo "denunciar empresa" |
| **consumidor.gov.br** | Senacon/MJSP | Reclamação contra empresa (inclui consignado) | Link |
| **MED** (app do banco) | BCB / bancos | Devolução de Pix por golpe | Conteúdo educativo pós-golpe |

Fontes: https://www.naomeperturbe.com.br/inicio.html · https://abbc.org.br/autorregulacao-nao-me-perturbe/ ·
https://qualempresameligou.com.br/ · https://www.gov.br/anatel/pt-br/consumidor/chamadas-abusivas

## 7. LGPD, honra e responsabilidade

### 7.1 O número é dado pessoal?

- **Número de pessoa física = dado pessoal** (LGPD, Lei 13.709/2018, art. 5º I: informação relacionada a pessoa
  natural identificada ou identificável). Telefone identifica com facilidade via cruzamento.
- **Número de PJ** em si não é dado pessoal, **mas** pequenos negócios/MEI e celulares corporativos de
  funcionários frequentemente apontam para uma pessoa → tratar **todo número como potencialmente pessoal**.
- Hash não anonimiza: o espaço de celulares BR é pequeno (67 DDDs × 10⁸ ≈ 6,7 × 10⁹ números) e um hash
  simples é revertido por força bruta em horas. Dataset publicado com hash continua sendo dado pessoal
  (pseudonimizado; LGPD art. 12 e art. 13 §4º).
  Usar HMAC com segredo ou k-anonimato por prefixo; ver SECURITY/PRIVACY agents.

### 7.2 Base legal recomendada

- **Denúncia feita pelo usuário**: consentimento do denunciante para os dados *dele* (art. 7º I); para o número
  denunciado (terceiro), **legítimo interesse** (art. 7º IX) de proteger usuários contra fraude, com **teste de
  balanceamento** documentado (finalidade → necessidade → balanceamento e salvaguardas), conforme Guia da ANPD
  (fev/2024). O Guia diz que a mesma sistemática vale para "prevenção à fraude e segurança do titular".
  https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-orientativo-sobre-legitimo-interesse
- Salvaguardas mínimas: minimização (só número + categoria + timestamp grosso), sem texto livre público, limite
  de retenção, decaimento de score, canal de contestação/opt-out para o titular (art. 18), relatório de impacto
  (RIPD) antes do backend público.
- **Processamento local no aparelho** (score/heurística offline) reduz drasticamente o risco: não há tratamento
  pelo projeto se o dado não sai do dispositivo.

### 7.3 Risco de calúnia/difamação e de responsabilidade civil

- Rotular publicamente um número como "GOLPE"/"criminoso" pode ser imputação de fato criminoso a pessoa
  identificável (calúnia, CP art. 138) ou ofensa à reputação (difamação, art. 139) e gerar dano moral (CC
  art. 186/927). Spoofing torna o erro **provável**, não só possível.
- Marco Civil (Lei 12.965/2014) art. 19: provedor de aplicação responde por conteúdo de terceiro após ordem
  judicial descumprida — mas o **score/rótulo gerado pelo próprio projeto** é conteúdo nosso, não de terceiro.
  [Interpretação; NV por advogado.]
- **Redação obrigatória na UI e nos datasets**: "**Denunciado por N usuários como** possível golpe",
  "**Suspeito** de telemarketing", "Padrão compatível com robocall". **Nunca**: "Golpista", "Criminoso",
  "Fraude confirmada", nome de pessoa.
- **Fluxo de contestação**: qualquer titular pode contestar (sem login obrigatório, com prova de posse via
  chamada/SMS de verificação); rótulo vai para "em revisão" em até 72 h; resultado registrado; números
  contestados com sucesso entram em lista de proteção com decaimento.
- Nunca exibir quem denunciou; nunca publicar comentários livres sobre números.

## 8. Decisões propostas para o motor (para os agentes de core/regras)

1. Emergência/utilidade: lista de `brazil-numbering.json` (`never_block: true`), incluindo 191, 188, 153, 185,
   112/911; corrigir 195/198 em `emergency.ts`.
2. 0303 → `kind: 'massCaller'` (ou similar), risco estrutural baixo/médio (~30), rótulo "Chamada em massa
   identificada (telemarketing, cobrança ou doação)"; preferência do usuário decide.
3. 0900 → anomalia (serviço suspenso); 0500 → doação, risco baixo, alerta educativo; 0300 → adicionar.
4. Validar DDD contra a lista de 67; DDD inexistente + 10/11 dígitos = `unknown` com risco moderado (comum em spoofing).
5. Fixo N8 = 2–6; móvel N9 = 9 (aceitar 7/8 como `mobile` com flag de baixa confiança).
6. Selo de autenticação do SO → sinal positivo forte; `FAILED` → SPOOFING alto.
7. Heurística agregada de chamadas ≤ 6 s para CampaignDetector (nunca individual).
8. UI e datasets seguem a redação da seção 7.3.

## 9. Pendências / não verificado

- Data exata de início da obrigatoriedade do 0303 (mar/2022) — ler texto do Ato 10.413/2021.
- Norma Anatel dos NUN (3003/4003/4004/4020) e existência de 3004/4002/4024.
- Comprimento/padrão oficial de short codes SMS (não há norma; acompanhar diretório ABR Telecom).
- API Android de verificação de chamada com operadoras brasileiras (teste em campo).
- Estatística mensal oficial de chamadas curtas em formato aberto (só há números em notícias/painéis).
- Existência de lista oficial e licenciada de números de SAC de bancos (não encontrada).
- Parecer jurídico sobre a seção 7 (texto aqui é análise técnica, não opinião legal).
