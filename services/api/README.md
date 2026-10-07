# @antispam-br/api — Community API (M8)

API comunitária do AntiSpam BR. **Privacidade primeiro**: a API só conhece
`SHA-256(number)` — o número cru nunca chega ao servidor.

## Rodar (dev)

```bash
cd services/api
npm install
npm run dev        # http://localhost:8787
npm test           # 21 testes (reputation, anti-abuse, Ed25519, HTTP)
npm run typecheck
```

## Endpoints (v1)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/v1/health` | Health check |
| GET | `/v1/numbers/:hash/reputation` | Reputação agregada (score 0–100 + label) |
| POST | `/v1/reports` | Denúncia (number_hash + category + confidence + source + reporter_hash) |
| POST | `/v1/reports/:id/vote` | `confirm` ou `contest` |
| POST | `/v1/numbers/:hash/legitimate` | Contestação direta (número é legítimo) |
| GET | `/v1/datasets/manifest` | Manifest do dataset atual (assinado Ed25519) |
| GET | `/v1/datasets/:version` | Metadados da versão |
| GET | `/v1/campaigns` | Rajadas ativas (agregado, ≥5 denúncias/48h) |

## Anti-abuse (§ANTI-POISONING)

| Defesa | Onde | Como |
|---|---|---|
| Denúncia isolada não decide | `reputation.ts` | Mínimo de 2 denunciantes distintos; abaixo disso score = 0 |
| Bot reporting | `reputation.ts` | Burst filter: >3 denúncias/hora do mesmo reporter = peso 0 |
| Falsos positivos | `reputation.ts` | `LEGITIMATE`/contestações subtraem até 45 pontos |
| Replay | `antibuse.ts` | Timestamp futuro (>5min) ou >7 dias rejeitados |
| Duplicidade | `antibuse.ts` + store | Dedup por `numberHash+reporterHash+minuto` |
| Sybil / contas descartáveis | `antibuse.ts` | Peso do reporter: 0,25 (novo) → 1,5 (fiel); contestado cai; quarentenado = 0 |
| Targeted harassment | `antibuse.ts` | Outlier detection: reporter solitário recorrente tem peso ×0,5 |
| Payload abuse | `server.ts` | Limite de 16 KB, validação estrita de campos (422) |

## Reputação (§REPUTATION)

Score 0–100 com thresholds configuráveis (`DEFAULT_THRESHOLDS`):
`CLEAN <20 | LOW_RISK <40 | SUSPICIOUS <60 | SPAM <80 | HIGH_RISK ≥80`.

Componentes: volume ponderado (saturação logarítmica, máx 60) +
credibilidade por denunciantes distintos (máx 12) + rajada recente 48h (máx 20)
− contestações (máx 45). Peso temporal com half-life de 14 dias.

## Datasets assinados (§DISTRIBUIÇÃO)

`datasets.ts`: manifest assinado **Ed25519** (@noble/curves). O app verifica:
1. assinatura sobre o cânon JSON; 2. SHA-256 de cada arquivo; 3. anti-rollback
de versão. `generateKeyPair()` só para bootstrap/testes — em produção, chave
em KMS/HSM e pública pinada no app.

## Banco (produção)

`db/schema.sql` (Postgres): `phone_numbers`, `reports` (particionado por mês),
`user_reputations`, `campaigns`, `moderation_decisions`, `dataset_versions` +
materialized view `reputation_mv` (leitura O(1), refresh periódico).
Índices: `(number_hash, reported_at DESC)`, `(reporter_hash, ...)`, `(category, ...)`.

## Não exposto (por design)

- Denúncias individuais por número (só agregados) — anti-assédio/doxxing.
- Qualquer associação de número a pessoa/nome — não coletamos.
- Comment sem moderação (campo reservado; publicação só após `moderation_decisions`).
