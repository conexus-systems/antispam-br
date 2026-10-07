# ADR 0007 — Backend TypeScript + PostgreSQL

## Contexto

O snapshot anterior tem uma API Express com store em memória e um schema Postgres não usado.
O backend precisa: aceitar denúncias com anti-abuse, calcular reputação, gerar datasets
assinados e servir um portal estático. Carga esperada no beta: baixa (milhares de denúncias/dia),
com leitura pesada absorvida por CDN (datasets estáticos).

## Decisão

- Node 22 + TypeScript, workspace npm. Reaproveita `packages/datasets`, `packages/reputation` e
  `packages/phone-normalizer` — os mesmos pacotes geram os vetores de teste.
- PostgreSQL 16: `reports` particionada por mês, `reputations` como tabela materializada por job
  (não MV global — refresh incremental por número tocado), índices por `(number_e164, reported_at)`.
- Sem Redis no início: rate limit em Postgres (`UNLOGGED` table) e cache HTTP/CDN. Redis só se
  medição justificar.
- Datasets publicados como arquivos estáticos (Object Storage + CDN); a API só serve o manifest
  atual e redireciona.
- Chave privada de assinatura fora do servidor da API (job de publicação isolado; CI secret ou HSM).

## Consequências

- Uma linguagem para backend, portal e ferramentas de dados.
- Datasets resistem a queda da API (estáticos + assinados).
