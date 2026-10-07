# FEATURE MATRIX — AntiSpam BR

> Análise comparativa de funcionalidades dos projetos open source pesquisados (ver `REPOSITORIES.md`).
> Metodologia: **análise conceitual apenas** — nenhum código foi copiado (ver `LEGAL_AND_LICENSE_REVIEW.md`).

## Legenda

- ✅ implementado
- ⚠️ parcial / com ressalvas de plataforma
- ❌ não suportado pela plataforma ou não planejado
- 🔜 planejado (roadmap)

## 1. Matriz de features — projetos pesquisados vs. AntiSpam BR

| Feature | SpamBlocker (aj3423) | Yet Another Call Blocker | Blockers F-Droid típicos | Truecaller (referência proprietária) | **AntiSpam BR** |
|---|---|---|---|---|---|
| CallScreeningService (Android) | ✅ | ✅ | ✅ | ✅ | ✅ (módulo Expo local + RoleManager) |
| Decisão 100% on-device | ✅ | ⚠️ (lookup rede p/ dados ricos) | ✅ | ❌ (nuvem) | ✅ (fail-safe ALLOW, p95 < 100 ms) |
| Whitelist / blacklist manual | ✅ | ✅ | ✅ | ✅ | ✅ (M3) |
| Regras por prefixo / regex / horário | ⚠️ | ✅ | ✅ | ✅ | ✅ (RuleEngine, M4) |
| Base local pré-carregada | ⚠️ (arquivo externo) | ✅ (snapshot DAG) | ⚠️ | ✅ (nuvem) | ✅ (LocalReputation, M5) |
| Score composto multi-sinal 0–100 | ❌ (binário) | ⚠️ (média de votos) | ❌ | ✅ (caixa-preta) | ✅ (SpamScore auditável, M6) |
| Explicabilidade da decisão | ❌ | ⚠️ | ❌ | ❌ | ✅ (razões legíveis por decisão) |
| Falsos positivos / contestação | ⚠️ | ⚠️ | ❌ | ✅ | ✅ (contestações penalizam score) |
| Detecção de campanhas | ❌ | ❌ | ❌ | ⚠️ | ✅ (CampaignDetector, M9) |
| Números BR (regras 0303, 0800, DDD) | ❌ | ❌ | ❌ | ✅ | ✅ (BrazilRules, M6) |
| Números de emergência protegidos | ✅ | ✅ | ✅ | ✅ | ✅ (nunca bloqueados, hard-coded) |
| Denúncias com anti-abuse | ❌ | ⚠️ | ❌ | ✅ (fechado) | ✅ (M8 local: denunciantes únicos, recência) |
| SMS scam engine | ❌ | ❌ | ⚠️ | ✅ | 🔜 M4 do roadmap (heurísticas locais; iOS via ILMessageFilter) |
| Base comunitária assinada (deltas) | ❌ | ⚠️ (sem assinatura formal) | ❌ | ✅ (fechado) | 🔜 M8: manifest Ed25519 + SHA-256 |
| iOS (Call Directory / IdentityLookup) | ❌ | ❌ | ❌ | ✅ | 🔜 M6 do roadmap |
| ML local (classificador) | ❌ | ❌ | ❌ | ✅ | 🔜 M10 (ONNX Runtime Mobile, opt-in) |
| Backup/restauração validado | ⚠️ | ❌ | ⚠️ | ✅ | ✅ (backup com validação) |
| Sem anúncios / sem venda de dados | ✅ | ✅ | ✅ | ❌ | ✅ (princípio do projeto) |
| Open source (MIT) | ✅ (GPL-3.0) | ✅ (GPL-3.0) | variadas | ❌ | ✅ MIT |

## 2. Diferenciais do AntiSpam BR identificados na análise

1. **Explicabilidade como primeira classe** — nenhum projeto open source pesquisado expõe *por que* bloqueou; nosso pipeline retorna razões legíveis que alimentam a UI e o dossiê para B.O.
2. **Score multi-sinal auditável** — combinação determinística de reputação local + campanha + padrão BR + regras explícitas, com testes unitários cobrindo cada sinal (em vez de heurística caixa-preta).
3. **Anti-abuse desde o dia 1 no cliente** — denúncia isolada nunca decide; exigência de denunciantes distintos + análise temporal já no motor local, antes mesmo do backend comunitário.
4. **Regras Brasil nativas** — 0303 (telemarketing regulado), 0800, códigos de país de risco, DDDs — não é adaptação de app gringo.
5. **Números de emergência intocáveis** — proteção hard-coded acima de qualquer regra ou lista (conformidade e segurança).

## 3. Lacunas dos projetos pesquisados que vamos atacar

| Lacuna observada | Nossa resposta |
|---|---|
| Bases comunitárias sem proteção contra envenenamento (Sybil) | Rate limiting + peso por reputação do denunciante + quarentena (M8) |
| Blocos binários (lista sim/não) gerando falsos positivos | Score 0–100 com faixas configuráveis → ALLOW/WARN/SILENCE/BLOCK |
| Sem critério público de decisão | Docs de arquitetura + threat model + razões por decisão |
| Dependência de rede no caminho crítico da chamada | Decisão local obrigatória; rede só alimenta cache em background |
| UI datada / sem acessibilidade | Design system próprio (tema escuro, componentes próprios) |
