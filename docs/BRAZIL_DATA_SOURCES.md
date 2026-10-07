# BRAZIL DATA SOURCES — AntiSpam BR

> Avaliação de fontes de dados brasileiras antes de **qualquer** coleta automatizada.
> Checklist obrigatório por fonte: termos de uso → licença → robots.txt → API oficial → LGPD → redistribuição.
> Se qualquer item falhar: **não coletar**.

## 1. Fontes avaliadas

### 1.1 Denúncias dos usuários do app (fonte primária)
- **Termos**: nossos próprios termos; opt-in por denúncia.
- **LGPD**: base legal = consentimento; dados = número (hash remoto), categoria, timestamp; sem comentários públicos identificáveis.
- **Redistribuição**: apenas agregada/anonimizada em datasets públicos.
- **Status**: ✅ em uso (local, M8 traz o backend).

### 1.2 Anatel — dados abertos
- **URL**: https://www.gov.br/anatel/ (dados abertos em dadosabertos.anatel.gov.br quando aplicável)
- **Termos**: open data governamental com licença declarada por dataset (típico: CC-BY ou similar).
- **Robots/API**: portal de dados abertos com download direto (não é scraping).
- **Uso potencial**: listas de prefixos homologados, dados de outorga, estatísticas de chamadas abusivas reguladas.
- **Status**: ⚠️ a validar dataset a dataset no momento de integrar (registrar licença específica aqui).

### 1.3 Não Me Perturbe (nmp.org.br)
- **O que é**: registro nacional opt-out de telemarketing (consumidor cadastra o próprio número).
- **Termos**: não há API pública nem autorização de redistribuição.
- **Status**: ❌ não coletar. Referência conceitual apenas (categoria TELEMARKETING e thresholds).

### 1.4 Sites agregadores de reputação (Qual Empresa Me Ligou e similares)
- **Termos**: proíbem scraping/redistribuição; conteúdo gerado por usuários sem licença aberta.
- **Status**: ❌ não coletar. Anti-modelo legal.

### 1.5 Operadoras / Origem Verificada (ABR Telecom)
- **O que é**: atestação criptográfica de origem de chamada (anti-spoofing), sinalizado em banda.
- **Coleta?**: não é dataset — é sinal em runtime, quando a plataforma expõe.
- **Status**: ✅ usado como sinal opcional no score (nunca armazenado como base).

### 1.6 Listas públicas de segurança (CSIRT/CERT.br, PhishTank-like BR)
- **Cert.br**: publica alertas e estatísticas; páginas com termos próprios — **não** são datasets de números.
- **Status**: ⚠️ útil para pesquisas de padrões de smishing (textual), não para listas de números.

## 2. Protocolo antes de adicionar qualquer nova fonte

1. Documentar URL + termos + licença nesta tabela.
2. Verificar robots.txt e existence de API oficial.
3. Avaliar LGPD (dados pessoais? números de terceiros?).
4. Testar viabilidade de redistribuição (licença permite criar derivado público?).
5. Aprovação do SECURITY_AGENT + PRIVACY_AGENT registrada em `agents/*/DECISIONS.md`.
6. Só então implementar ingestion com rate limit e identificação de user-agent honesta.

## 3. Regras de ouro (anti-abuso de coleta)

- Nunca burlar autenticação, paywall, captcha ou rate limit.
- User-agent identificável com contato.
- Coleta incremental e com espaçamento (sem impacto ao serviço).
- Datasets derivados publicados **somente** com dados agregados/anonimizados + licença explícita (CC0/ODbL).
