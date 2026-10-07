# BRAZIL DATA SOURCES — AntiSpam BR

> Avaliação de fontes brasileiras **antes** de qualquer coleta automatizada. Autor: BRAZIL_TELECOM_AGENT.
> Acesso a todas as URLs e robots.txt: **2026-10-07**. Contexto regulatório: [`docs/research/BRAZIL.md`](research/BRAZIL.md).
> Regra: termos → licença → robots.txt → API oficial → LGPD → redistribuição. Qualquer falha = **não coletar**.
> Nunca burlar CAPTCHA, login, WAF, rate limit ou paywall. "Robots permite" **não** é licença.

## 1. Legenda de decisão

| Decisão | Significado |
|---|---|
| **USAR** | Licença aberta explícita; ingestão automatizada permitida com atribuição |
| **USAR COM RESSALVA** | Dado público sem licença explícita ou com condição; ingestão manual/esporádica, atribuição, revisão humana |
| **SÓ LINK** | Serviço oficial útil ao usuário, mas sem API/licença ou com CAPTCHA → app abre o site oficial |
| **NÃO USAR** | Termos, LGPD ou natureza do dado impedem uso |

## 2. Tabela de fontes

| # | Fonte | URL | Dono | Tipo de dado | Formato | API oficial? | Termos / licença | robots.txt (2026-10-07) | Risco LGPD | Redistribuição? | Decisão |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Denúncias dos usuários do app | — | AntiSpam BR | número, categoria, timestamp | interno | n/a | nossos termos + opt-in | n/a | **Alto** (número de terceiro) | só agregado/pseudonimizado | **USAR** (fonte primária) |
| 2 | Anatel — Regulamento Geral de Numeração (Res. 749/2022) | https://informacoes.anatel.gov.br/legislacao/resolucoes/2022/1641-resolucao-749 | Anatel | regras de formato de numeração | HTML | não | ato normativo público (lei/ato oficial não tem proteção autoral — Lei 9.610/98 art. 8º IV) | host responde **423** a clientes não-navegador; sem robots legível | nenhum | sim (fatos normativos) | **USAR** (transcrição manual em `brazil-numbering.json`) |
| 3 | Anatel — tabela SUP/emergência (1XX) | https://www.gov.br/anatel/pt-br/regulado/numeracao/codigos-nacionais/servicos-de-utilidade-publica-e-de-emergencia | Anatel | códigos 1XX e serviço | HTML | não | conteúdo gov.br; ato público | `www.gov.br/robots.txt`: `User-Agent: *` permite exceto caminhos de formulário/ebserh/mre; página permitida | nenhum | sim | **USAR** (manual) |
| 4 | dados.gov.br — "Serviços de Utilidade Pública e de Apoio ao STFC" | https://dados.gov.br/dados/conjuntos-dados/servicos-de-utilidade-publica-e-de-apoio-a-telefonia-fixa | Anatel (ORCN) | códigos 1XX | CSV, ODT | portal CKAN (API do portal) | **Creative Commons Attribution** | `dados.gov.br/robots.txt` → **HTTP 401** (portal exige navegador/login p/ alguns recursos) | nenhum | **sim, com atribuição** | **USAR** (arquivo desatualizado: último arquivo 15/04/2019 — conferir com fonte 3) |
| 5 | Anatel — Códigos Não Geográficos | https://www.gov.br/anatel/pt-br/regulado/numeracao/codigos-nacionais/codigos-nao-geograficos | Anatel | destinação 0800/0300/0303/0500/0900 | HTML | não | gov.br público | permitido (ver #3) | nenhum | sim | **USAR** (manual) |
| 6 | Anatel — Painel Áreas Tarifárias (município → DDD) | https://informacoes.anatel.gov.br/paineis/areas-tarifarias/codigos-nacionais | Anatel | CN por município | painel (Power BI/HTML) | não | gov público; licença não declarada no painel | 423 a clientes não-navegador | nenhum | sim (fato) | **USAR COM RESSALVA** (export manual pontual; 67 DDDs já transcritos) |
| 7 | nSAPN / EASI — Arquivos Públicos de Numeração (prefixos por prestadora, SMP/STFC/CNG) | https://easi.abrtelecom.com.br/ | ABR Telecom como EASI, por determinação da Anatel | faixas/prefixos atribuídos por prestadora e serviço | download TXT/CSV (opção "Download") | não (download público, sem API documentada) | Anatel: "informações do banco de dados são **públicas**" (FAQ Numeração); **licença não declarada** | **HTTP 503** a `curl` (proteção/indisponível); não testado em navegador | nenhum (faixas, não titulares) | não declarada → confirmar por e-mail | **USAR COM RESSALVA** |
| 8 | dados.gov.br — Acessos SMP/STFC, Outorga e Licenciamento | https://dados.gov.br/dados/conjuntos-dados/acesso-autorizadas-stfc | Anatel | estatísticas agregadas de acessos/prestadoras | CSV | portal CKAN | **Creative Commons Attribution** | 401 (ver #4) | nenhum | sim, com atribuição | **USAR** (só para métricas/painel; não alimenta score) |
| 9 | Anatel — Chamadas Abusivas / Medidas Cautelares | https://www.gov.br/anatel/pt-br/consumidor/chamadas-abusivas | Anatel | regras, totais divulgados | HTML/PDF | não | gov.br público | permitido | nenhum | sim (fatos, com citação) | **USAR** (referência documental, manual) |
| 10 | Qual Empresa Me Ligou | https://qualempresameligou.com.br/ | Prestadoras de telecom; operado pela ABR Telecom (art. 6º Desp. 250/2022) | razão social/CNPJ do titular PJ de um número | web form + **CAPTCHA** | **não** | Termos: site, informações e materiais "de propriedade da ABR TELECOM", nenhum direito concedido; finalidade de consulta individual | `/robots.txt` → **404** ("Cannot GET") — ausência de robots não autoriza coleta | baixo para PJ, mas finalidade restrita | **não** | **SÓ LINK** |
| 11 | Não Me Perturbe | https://www.naomeperturbe.com.br/ | ABR Telecom (PI), com prestadoras + bancos de consignado (Febraban/ABBC) | cadastro opt-out do próprio titular | web com login | **não** | Termos §8: conteúdo "de propriedade da ABR Telecom"; base de cadastrados é **dado pessoal** sob controle deles | `/robots.txt` → página 404 | **Muito alto** (lista de titulares) | **não** | **SÓ LINK** (incentivar o usuário a se cadastrar) |
| 12 | Consulta Número (portabilidade) | https://consultanumero.abrtelecom.com.br/consultanumero/ | ABR Telecom (Entidade Administradora da Portabilidade) | prestadora atual/histórico de 1 número | web form | não (BDR é restrita a prestadoras) | Termos: consulta individual pelo usuário; dado coletado = o número consultado | **HTTP 503** a `curl` | médio (consultar número de terceiro em massa expõe-o à ABR) | **não** | **SÓ LINK** |
| 13 | Origem Verificada (ABR Telecom / AIA) | https://origemverificada.com.br/faq | ABR Telecom | sinal de autenticação **em tempo de chamada** | sinalização de rede (SIP/Identity) exposta pelo SO | não para terceiros | contratação só por prestadoras/empresas chamadoras | `/robots.txt` devolve o HTML do SPA (sem regras) | nenhum (sinal no aparelho) | n/a | **USAR** como sinal de runtime do SO; nunca armazenar como base |
| 14 | Febraban — notícias/alertas de golpes | https://portal.febraban.org.br/noticia/4381/pt-br/ | Febraban | estatísticas e descrições de golpes | HTML | não | direitos reservados (sem licença aberta) [NV: termos não lidos na íntegra] | permite `/noticia/`; bloqueia `/Busca/`, parâmetros de tracking, `/en/` | nenhum | só citação curta com link | **SÓ LINK** / citação |
| 15 | Banco Central — Pix/MED (guias, regulamento) | https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Guia_MED.pdf | BCB | regras do MED | PDF | BCB tem APIs de dados (SGS/Olinda), não de golpes | publicação oficial | `User-agent: *` `Allow: /`, bloqueia `/_catalogs`, `/Lists/`, `/Forms/`, `/_layouts/` | nenhum | citação | **USAR** (conteúdo educativo, manual) |
| 16 | Receita Federal / Correios / INSS / Serasa — alertas de golpe | ver `research/BRAZIL.md` §5 | respectivos órgãos/empresa | padrões textuais de golpe | HTML | não | gov.br público (RF, INSS); Correios e Serasa: direitos reservados | gov.br permitido; demais não verificados [NV] | nenhum | gov: sim com citação; privados: só citação | **USAR** (manual) para frases-gatilho; **SÓ LINK** para conteúdo privado |
| 17 | consumidor.gov.br | https://www.consumidor.gov.br/ | Senacon/MJSP | reclamações contra empresas | web; há dados abertos de reclamações [NV] | [NV] | gov | `Disallow: /pages/usuario/`, `/pages/ticket/`, `/pages/administrativo/`, `/pages/reclamacao/` | médio (texto de consumidores) | [NV] | **SÓ LINK** (avaliar dataset aberto depois) |
| 18 | Agregadores privados de reputação (sites "quem me ligou", apps comerciais) | — | privados | comentários de usuários sobre números | HTML | geralmente não | proíbem scraping/redistribuição; UGC sem licença | variável | **Alto** (comentários identificam pessoas, risco de difamação) | não | **NÃO USAR** |
| 19 | CERT.br — alertas e estatísticas | https://www.cert.br/ | NIC.br | estatísticas de incidentes, cartilha | HTML/PDF | não | direitos do NIC.br; cartilha com licença própria [NV] | [NV] não buscado | nenhum | citação | **SÓ LINK** (contexto de smishing) |

## 3. Notas por fonte relevante

### 3.1 Normas Anatel (fontes 2, 3, 5, 9)
- Textos normativos oficiais não são protegidos por direito autoral (Lei 9.610/1998, art. 8º, IV). Por isso a
  transcrição de **fatos** (formatos, códigos, destinações) em `data/rules/brazil-numbering.json` é segura.
- `informacoes.anatel.gov.br` e `sistemas.anatel.gov.br` responderam **HTTP 423** a requisição `curl` com
  user-agent identificado → há WAF. **Não** contornar; coleta é manual, por pessoa, com revisão a cada release.

### 3.2 dados.gov.br (fontes 4, 8)
- Licença declarada nos metadados: **Creative Commons Attribution** (atribuição obrigatória: "Fonte: Anatel /
  dados.gov.br"). Compatível com MIT do código e com datasets CC-BY/ODbL nossos.
- `robots.txt` retornou 401 e algumas páginas exigem JavaScript. O portal oferece API CKAN; usar **apenas os
  links de recurso (arquivo CSV) publicados**, nunca varrer o HTML.
- Dataset SUP: arquivo de 2019 → serve para conferência; a verdade operacional é a página Anatel (fonte 3).

### 3.3 nSAPN / Arquivos Públicos de Numeração (fonte 7)
- Valor: mapear **faixa → prestadora → tipo (SMP/STFC/CNG)**, detectar número em faixa **não atribuída** (forte
  indício de spoofing; a Anatel proíbe tráfego de recursos "não atribuídos, vagos ou em quarentena" — Ato 12.712, 4.1.5).
- Ressalvas: licença não declarada; host devolveu 503 a `curl`; com portabilidade, faixa ≠ prestadora atual.
- Antes de automatizar: enviar e-mail à ABR Telecom/Anatel (orcn@anatel.gov.br) pedindo confirmação de reuso e
  redistribuição; registrar resposta em `agents/*/DECISIONS.md`. Até lá: download **manual** e uso **interno**
  (gerar só um bitmap "faixa atribuída sim/não" por prefixo, sem redistribuir o arquivo bruto).

### 3.4 Qual Empresa Me Ligou / Consulta Número / Não Me Perturbe (fontes 10–12)
- Todos operados pela ABR Telecom, sem API, com termos que reservam todos os direitos; o QEML usa CAPTCHA.
- Consulta automatizada em massa seria: (a) burla de CAPTCHA, (b) violação dos termos, (c) envio massivo de
  números de terceiros a outro controlador (LGPD). **Proibido.**
- Uso permitido: botão no app que abre o site oficial com instrução "copie o número" (sem preencher
  automaticamente via script). Mostrar o resultado só se o **usuário** o colar de volta (opcional).

### 3.5 Origem Verificada (fonte 13)
- Não é dataset. O sinal chega ao aparelho via rede; o app só lê o status que o SO expõe na chamada corrente.
- Não persistir "este número é verificado" como fato global: a verificação é por chamada.

### 3.6 Febraban / BCB e a tentação da "allowlist de bancos" (fontes 14, 15)
- Não há dataset oficial, licenciado e mantido de "números de SAC/telefones oficiais de bancos" que
  encontrei (Febraban e BCB publicam orientação, não lista) — **[NV]** de forma exaustiva.
- Mesmo que existisse, allowlist por número é perigosa: a falsa central usa **spoofing de números oficiais**
  (Febraban, 01/07/2026). Um número "oficial" na allowlist viraria passe livre para o golpe.
- Decisão: confiar em banco **só** via autenticação de chamada (fonte 13) ou contato salvo pelo usuário.
  O BCB entra apenas como conteúdo educativo (MED: 80 dias para pedir devolução pelo app do banco).

### 3.7 Alertas oficiais de golpe (fonte 16)
- Uso: extrair **padrões textuais** (não números) para o classificador local de SMS, com citação e data:
  Receita/Correios ("taxa de reenvio/liberação", "encomenda retida/leiloada", link de pagamento por SMS),
  INSS ("prova de vida", "benefício será cortado"), Serasa ("taxa para liberar acordo", pedido de código SMS).
- Números citados em alertas (ex.: "4XXX2266" no alerta do INSS, jan/2025) são parciais/mascarados → não
  viram regra automática; podem orientar uma regra manual revisada.
- Canais oficiais citados (Correios 3003-0100 / 0800 725 7282; Serasa WhatsApp (11) 99575-2096; INSS 135)
  podem aparecer como **informação** ao usuário ("o canal oficial é…"), nunca como allowlist automática.

### 3.8 Fontes descartadas
- Agregadores privados (fonte 18): além dos termos, o conteúdo é UGC com nomes e acusações → risco de
  difamação herdado. Não usar nem como "semente" de dataset.
- Listas "vazadas" de telemarketing/discadores em fóruns ou GitHub sem licença/procedência: **NÃO USAR**
  (origem ilícita provável, dado pessoal, sem base legal).

## 4. Plano de ingestão (somente fontes USAR / USAR COM RESSALVA)

| Fonte | Frequência | Método | Taxa educada | Cache / versionamento | Saída |
|---|---|---|---|---|---|
| 2, 3, 5 (normas Anatel) | revisão manual a cada release ou alerta de nova norma | humano lê e transcreve | n/a (sem robô) | `brazil-numbering.json` com `version` e `source_urls` | regras do motor |
| 4 (SUP CSV, CC-BY) | trimestral | 1 GET do arquivo de recurso publicado; checar `ETag`/`Last-Modified` | 1 requisição/execução | guardar CSV + SHA-256 em `data/raw/anatel/` com data | diff contra `emergency_and_utility`; divergência → issue, nunca auto-merge |
| 6 (painel DDD) | anual ou quando a Anatel anunciar mudança de CN | export manual | n/a | anexar ao PR | `ddds[]` |
| 7 (nSAPN) | mensal (arquivos atualizados semanalmente aos sábados à noite, segundo a Anatel) | **manual** até confirmação de reuso; depois, 1 download/mês por tipo de serviço | ≤ 1 req a cada 10 s, User-Agent `AntiSpamBR-ingest/<versão> (+URL do repo; contato)` | arquivo bruto **não** versionado publicamente; publicar só derivado mínimo (prefixo atribuído s/n) | sinal "faixa não atribuída" |
| 8 (acessos CC-BY) | trimestral | GET do CSV de recurso | 1 req/arquivo | `data/raw/anatel/` + SHA-256 | só painel/estatística |
| 13 (Origem Verificada) | por chamada | API do SO no aparelho | n/a | não persistir | sinal de score |
| 15/16 (alertas oficiais) | semestral | leitura humana | n/a | citações com data em `research/BRAZIL.md` | frases-gatilho do classificador local |

Regras transversais da ingestão:
- User-Agent honesto com contato; respeitar `robots.txt` **e** termos (o mais restritivo vence); parar em 4xx/5xx
  repetido (backoff exponencial, máx. 3 tentativas); nunca rodar a partir de IPs rotativos.
- Todo artefato derivado publicado leva: fonte, URL, data de acesso, licença, hash do arquivo de origem.
- Datasets públicos do projeto: só agregados/pseudonimizados com HMAC por release (ver `research/BRAZIL.md` §7) e
  licença explícita (CC-BY 4.0 se derivado de CC-BY; ODbL avaliar com PRIVACY_AGENT).

## 5. Riscos LGPD por tipo de dado

| Dado | Pessoal? | Base legal | Mitigação |
|---|---|---|---|
| Regras de numeração, 1XX, DDDs | não | n/a | — |
| Faixas por prestadora (nSAPN) | não | n/a | não confundir faixa com titular |
| Denúncia (número de terceiro) | **sim** (PF) / às vezes (PJ/MEI) | legítimo interesse (art. 7º IX) + teste de balanceamento (Guia ANPD fev/2024) | minimização, decaimento, contestação, sem texto livre público |
| Dados do denunciante | sim | consentimento (art. 7º I) | separar identidade do denunciante da denúncia |
| Lista de cadastrados do Não Me Perturbe | sim | não temos base | não acessar |
| Titular PJ via QEML | não para PJ; finalidade restrita pelos termos | n/a | só link |

## 6. Mapeamento fonte → sinal no motor

| Sinal | Fonte | Peso sugerido | Observação |
|---|---|---|---|
| Número é 1XX oficial → never_block | 3 / 4 | absoluto | lista em `brazil-numbering.json` |
| DDD inexistente (fora dos 67) | 2 / 6 | médio | comum em spoofing; não bloquear sozinho |
| Formato inválido (fixo N8 ∉ 2–6, móvel N9 ∉ 7–9) | 2 | médio | idem |
| Prefixo CNG (0800/0300/0303/0500/0900) | 5 | baixo–médio | 0900 suspenso = anomalia |
| Faixa não atribuída a nenhuma prestadora | 7 | alto | só após confirmação de reuso do nSAPN |
| Autenticação PASSED / FAILED | 13 | forte (±) | por chamada, não persistir |
| Denúncias agregadas + decaimento | 1 | principal | contestação reverte |
| Padrão textual de golpe em SMS | 16 | médio–alto | local, sem envio do texto |

## 7. Protocolo para adicionar nova fonte

1. Linha nova na tabela da seção 2 com **todas** as colunas preenchidas e data de acesso.
2. Buscar `https://<host>/robots.txt` com User-Agent identificado; registrar código HTTP e regras relevantes.
3. Ler termos de uso e licença; se ausentes, decisão máxima = USAR COM RESSALVA (manual) ou SÓ LINK.
4. Avaliar LGPD (dado pessoal? de quem? base legal? redistribuição expõe terceiros?).
5. Aprovação do SECURITY_AGENT + PRIVACY_AGENT registrada em `agents/*/DECISIONS.md`.
6. Só então implementar ingestão conforme seção 4.

## 8. Não verificado nesta rodada

- Termos completos de Febraban, Correios, Serasa, CERT.br e consumidor.gov.br (dataset de reclamações).
- Termos/licença do download nSAPN e se aceita cliente automatizado (host 503 a `curl`).
- `dados.gov.br/robots.txt` (401) — conteúdo real não lido.
- Existência de dataset aberto oficial com estatística mensal de chamadas curtas (não encontrado).
