# ROADMAP — AntiSpam BR

Atualizado em 2026-10-07. O protótipo Expo anterior está em `apps/legacy-expo/` (congelado, ADR 0001).

| Marco | Escopo | Status |
|---|---|---|
| **M0** | Research, ADRs, arquitetura, formato de dataset, threat model | ✅ concluído |
| **M1** | Android call blocker offline (nativo) | 🟡 núcleo pronto e validado em emulador; falta onboarding/UX e homologação em aparelhos reais |
| **M2** | Base comunitária + API em PostgreSQL | 🔜 próximo |
| **M3** | Publicação automática de datasets assinados + atualização no app | 🟡 cliente pronto (M1); falta pipeline de publicação e cerimônia de chaves |
| **M4** | Detecção de SMS fraudulento | 🟡 motor TS no protótipo; portar para Kotlin + share sheet (ADR 0008) |
| **M5** | Portal comunitário | 🟡 protótipo estático em `apps/web` |
| **M6** | iOS (Call Directory + Message Filter + Reporting; Live Caller ID depois) | 🔜 |
| **M7** | ML local | 🔜 |
| **M8** | Anti-abuse avançado | 🔜 |
| **M9** | Beta público brasileiro | 🔜 |
| **M10** | Google Play + F-Droid + App Store | 🔜 |

## M1 — Android offline (detalhe)

Entregue:
- `:engine` Kotlin puro: normalizador BR, regras do usuário, leitor de shard mmap, verificação Ed25519,
  instalador atômico com deltas, pipeline com guardas de falso positivo, detector de campanha.
- `:app`: `CallScreeningService` (API 29+), Room, DataStore, WorkManager, Compose (início, verificar
  número, histórico explicável com "Não é spam", listas, ajustes).
- 78 testes JVM + 3 instrumentados + E2E em emulador com ligações GSM e dataset servido por HTTP.

Falta para fechar M1:
1. Onboarding (explicar papel de triagem, DDD, modo) e estado "base vencida/ausente".
2. Localização das categorias na UI (hoje aparecem como `BANK_SCAM`).
3. Exportar/importar listas (JSON validado) e dossiê local para B.O.
4. Homologação em aparelhos reais: Samsung (One UI + Smart Call), Xiaomi (HyperOS), Motorola, Android 10–16.
5. Benchmark de cold start do processo até `respondToCall` em aparelho de entrada.
6. Dataset seed inicial publicado (depende de M3 ou de lista curada manualmente com fontes permitidas).

## M2 — Comunidade + API
1. `packages/reputation` com o algoritmo do ADR 0006 (peso por denunciante, Σw, meia-vida 30 d, quarentena de surto) + vetores `data/test-vectors/reputation.json`.
2. Migrar `services/api` de store em memória para PostgreSQL (migrations, testes de banco com container).
3. Token de dispositivo rotativo + PoW; rate limit por token e por rede; nonce anti-replay.
4. Consulta por hash-prefix (k-anonimato) e fila de contestação/moderação (`services/moderation`).
5. Envio opt-in de denúncias pelo Android (fila `local_reports.synced`).

## M3 — Publicação de datasets
1. Job `services/ingestion` aplica `PUBLICATION_POLICY` e gera shards/deltas com `packages/datasets`.
2. Assinatura com chave offline (CI secret isolado ou HSM), duas chaves embarcadas.
3. Publicação em Object Storage + CDN; manifest com `expires_at` de 14 dias.

## Riscos de cronograma
- Live Caller ID depende de aprovação/entitlement da Apple e de servidor PIR próprio.
- Políticas do Google Play para permissões de SMS impedem filtro automático no Play (por isso ADR 0008).
- Fontes brasileiras oficiais não oferecem API de reputação; a base depende da comunidade (ver `BRAZIL_DATA_SOURCES.md`).
