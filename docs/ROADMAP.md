# ROADMAP — AntiSpam BR

Atualizado em 2026-10-07. O protótipo Expo anterior está em `apps/legacy-expo/` (congelado, ADR 0001).

| Marco | Escopo | Status |
|---|---|---|
| **M0** | Research, ADRs, arquitetura, formato de dataset, threat model | ✅ concluído |
| **M1** | Android call blocker offline (nativo) | 🟡 núcleo pronto e validado em emulador; falta onboarding/UX e homologação em aparelhos reais |
| **M2** | Base comunitária + API em PostgreSQL | ✅ API, reputação, anti-poisoning e moderação (falta envio pelo Android) |
| **M3** | Publicação automática de datasets assinados + atualização no app | 🟡 publicação assinada a partir do banco pronta; falta Object Storage/CDN e cerimônia de chaves |
| **M4** | Detecção de SMS fraudulento | 🟡 motor TS no protótipo; portar para Kotlin + share sheet (ADR 0008) |
| **M5** | Portal comunitário | 🟡 portal estático servido pela API (consulta k-anônima, denúncia com PoW, campanhas) |
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

## M2 — Comunidade + API (detalhe)

Entregue:
- `packages/reputation` (ADR 0006 + adendo) com 27 testes e vetores adversariais em
  `data/test-vectors/reputation.json` (Sybil numa rede, Sybil espalhado, contas de uma semana,
  contestações em massa).
- `services/api` em PostgreSQL: migrations, denúncias particionadas por mês, retenção, dispositivo
  pseudônimo com PoW, nonce anti-replay, rate limit em tabela `UNLOGGED`, consulta k-anônima,
  votos por referência opaca, contestação, moderação com trilha de auditoria.
- 54 testes contra Postgres real no CI; imagem Docker; checagem de licenças e SBOM.

Falta:
1. Envio opt-in de denúncias pelo Android (fila `local_reports.synced`) e consulta pela API.
2. Endpoint de organizações verificadas (hoje só por SQL).

## M3 — Publicação de datasets
Entregue: `publish-dataset` gera shards/deltas/tombstones com `packages/datasets`, assina Ed25519,
versão monotônica `YYYYMMDDNN`, campanhas agregadas.
Falta:
1. Arquivos em Object Storage + CDN (hoje `bytea` no Postgres).
2. Cerimônia de chaves (chave offline/HSM, duas chaves embarcadas no app) e job agendado.

## Riscos de cronograma
- Live Caller ID depende de aprovação/entitlement da Apple e de servidor PIR próprio.
- Políticas do Google Play para permissões de SMS impedem filtro automático no Play (por isso ADR 0008).
- Fontes brasileiras oficiais não oferecem API de reputação; a base depende da comunidade (ver `BRAZIL_DATA_SOURCES.md`).
