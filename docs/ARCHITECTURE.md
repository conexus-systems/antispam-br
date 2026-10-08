# ARCHITECTURE — AntiSpam BR

Status: M0 concluído, M1 (Android offline) em andamento. Decisões formais em [`docs/adr/`](adr/README.md).

## 1. Princípios que moldam a arquitetura

| Princípio | Consequência técnica |
|---|---|
| Decisão on-device, nunca dependente de rede | Motor nativo + dataset local mmap; rede só em background (WorkManager / BGTask) |
| KPI = spam bloqueado **com mínimo de falsos positivos** | BLOCK exige evidência forte; heurística para em SILENCE; fail-open (ADR 0005) |
| Comunidade nunca é verdade absoluta | Publicação com limiar ponderado, quarentena, contestação (ADR 0006, `specs/PUBLICATION_POLICY.md`) |
| Privacidade honesta | Sem agenda, sem histórico, sem IDs de publicidade; hash de telefone **não** é tratado como anonimização (ADR 0004) |
| Android e iOS compartilham inteligência, não código | Dados + vetores de teste normativos (ADR 0002) |

## 2. Monorepo

```
apps/
  android/            Kotlin · Compose · Room · DataStore · WorkManager · CallScreeningService
    engine/           motor Kotlin/JVM puro (normalizador, regras, shard reader, Ed25519, instalador, pipeline)
    app/              app Android (UI, serviço de triagem, repositórios, updater)
  ios/                Swift/SwiftUI + Call Directory, Message Filter, Live Caller ID (M6)
  web/                portal comunitário estático
  legacy-expo/        protótipo React Native congelado (ADR 0001) — removido após paridade
services/
  api/                API comunitária (Node 22 + TS) → PostgreSQL: denúncias, moderação, publicação de datasets (`cli.ts publish`)
packages/
  phone-normalizer/   normalização BR (TS) — referência dos vetores
  datasets/           formato binário, manifest, assinatura, deltas, gerador de vetores
  reputation/         score comunitário + anti-poisoning (ADR 0006), puro e determinístico
  spam-engine/        (M4) motor SMS TS (hoje no legacy-expo, src/core/sms)
data/
  rules/              brazil-numbering.json (fatos verificados), regras padrão, categorias
  schemas/            JSON Schemas (report, rule, manifest)
  test-vectors/       vetores normativos: normalização, decisões, datasets assinados
  sms-corpus/         corpus anonimizado (spam, golpe, banco legítimo, OTP, entrega…)
  public/             exemplos públicos
infra/  docker/ terraform/ kubernetes/
docs/   adr/ specs/ research/ + documentos de M0
agents/ papéis dos agentes (ROLE/TASKS/DECISIONS) + ORCHESTRATOR
```

## 3. Fluxo de uma ligação (Android)

```
Telecom ──bind──▶ AntiSpamCallScreeningService.onScreenCall
                   │ (direção ≠ entrada → ALLOW imediato)
                   ▼
            ScreeningCoordinator.screen(raw, STIR)        orçamento 1,5 s · prazo do sistema 5 s
                   │ snapshot imutável em memória: regras compiladas + ajustes + denúncias próprias
                   ▼
            SpamEngine.decide ─ normalize ─ emergência/1XX ─ contato ─ allowlist/regras
                   │            ─ política do usuário (oculto/internacional) ─ denúncia própria
                   │            ─ dataset mmap (busca binária) ─ heurísticas ─ cache comunitário ─ modelo (M7)
                   ▼
            Decision(action, score, stage, reasons[])
                   ├─▶ respondToCall (ALLOW / WARN / setSilenceCall / disallow+reject, mantendo no registro)
                   └─▶ histórico local (Room, 90 dias) + notificação de aviso
```

Medido no emulador API 34: Telecom `SCREENING_BOUND → COMPLETED` em 2–4 ms; motor 0,3–1,5 ms.
Sem `READ_CONTACTS`: o sistema não envia ligações de contatos para triagem (proteção por construção).

## 4. Distribuição da base

```
denúncias ─▶ Postgres ─▶ reputação (job) ─▶ política de publicação ─▶ builder (packages/datasets)
                                                                        │ shards gzip por DDD + deltas
                                                                        │ manifest.json + .sig (Ed25519, chave offline)
                                                                        ▼
                                                              Object Storage + CDN (estático)
                                                                        │
             Android: SpamDatabaseUpdater (12 h, Wi-Fi) ─▶ DatasetInstaller (verifica tudo, staging, rename atômico)
             iOS: BGAppRefresh ─▶ mesmo formato ─▶ Call Directory (top-N, incremental)
```

Formato: [`specs/DATASET_FORMAT.md`](specs/DATASET_FORMAT.md). Proteções: assinatura, sha256 por
arquivo, tamanho, anti-rollback, `expires_at` anti-freeze, path allowlist, teto contra gzip bomb,
chaves `test-*` recusadas em release.

## 5. Plataformas — o que muda entre Android e iOS

| Capacidade | Android | iOS |
|---|---|---|
| Decisão em tempo real por chamada | Sim (`CallScreeningService`) | Não — lista pré-carregada (Call Directory) ou Live Caller ID (PIR, iOS 18+) |
| SILENCE | `setSilenceCall` | vira rótulo (WARN) |
| Regras de prefixo/regex | Sim | Não (só números concretos) |
| STIR/SHAKEN | `getCallerNumberVerificationStatus` (API 30+) | Não exposto |
| SMS | Compartilhar texto / Processar texto (ADR 0008) | `ILMessageFilterExtension` local, sem deferral de rede |
| Tamanho da base | Ilimitado na prática (mmap) | Top-N por shard, começando ≤ 200 k |

Detalhes: [`ANDROID_CAPABILITIES.md`](ANDROID_CAPABILITIES.md), [`IOS_CAPABILITIES.md`](IOS_CAPABILITIES.md).

## 6. Backend (M2)

- API (`services/api`, ver README): `GET /v1/numbers/{number}/reputation` (neutra até publicar),
  `GET /v1/reputation/hash-prefix/{prefix}` (k-anonimato), `POST /v1/reports`,
  `POST /v1/reports/{ref}/vote`, `POST /v1/numbers/{number}/legitimate`, `GET /v1/datasets/manifest`,
  `GET /v1/datasets/{version}`, `GET /v1/campaigns`, rotas de moderação com token.
- PostgreSQL 16: `reports` particionada por mês (retenção 14 meses, comentários 90 dias);
  `reputations` recalculada por número tocado e, de hora em hora, por tempo; rate limit em tabela
  `UNLOGGED`; estatísticas da frota em `fleet_stats`. Sem Redis (ADR 0007).
- Dispositivo pseudônimo com prova de trabalho de uso único; token guardado só como SHA-256; rede
  guardada só como HMAC do /24 (IPv4) ou /32 (IPv6). Nunca conta de usuário obrigatória.
- Publicação (`npm run publish-dataset`): recalcula, aplica a política do ADR 0006, gera shards,
  deltas e tombstones com `packages/datasets` e assina Ed25519 com chave fora da API.

## 7. Qualidade

| Camada | Testes hoje |
|---|---|
| `packages/phone-normalizer` | 39 (vetores) |
| `packages/datasets` | 11 (assinatura, adulteração, rollback, expiração, path traversal, delta) |
| `packages/reputation` | 27 (vetores adversariais de Sybil, contestação e surto) |
| `services/api` | 54 contra Postgres real (anti-abuso, moderação, datasets, retenção, portal) |
| `apps/android/engine` | 78 (vetores compartilhados + instalador + desempenho 1 M registros) |
| `apps/android/app` (instrumentado) | 3 (Room + coordenador em device) |
| E2E manual em emulador | 4 ligações GSM reais com dataset servido por HTTP |
