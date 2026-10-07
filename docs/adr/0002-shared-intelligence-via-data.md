# ADR 0002 — Inteligência compartilhada por dados + vetores de teste

## Contexto

Android (Kotlin), iOS (Swift), backend e portal (TypeScript) precisam concordar sobre:
normalização de números brasileiros, regras de numeração (DDD, 0303, emergências), categorias,
thresholds de reputação, formato binário do dataset e verificação de assinatura.
Compartilhar código (Kotlin Multiplatform, WASM, C) adicionaria toolchain e não roda nas
extensões iOS com o mesmo custo.

## Decisão

A fonte da verdade é **dado versionado**, não código:

| Artefato | Caminho | Consumidores |
|---|---|---|
| Fatos de numeração BR | `data/rules/brazil-numbering.json` | todos |
| Regras padrão | `data/rules/*.json` (schema `data/schemas/rule.schema.json`) | apps |
| Categorias e pesos | `data/rules/categories.json` | apps, backend |
| Formato de dataset | `docs/specs/DATASET_FORMAT.md` | backend (escrita), apps (leitura) |
| **Vetores de teste** | `data/test-vectors/*.json` | testes de **cada** implementação |

Cada implementação roda os mesmos vetores (`phone-normalization.json`, `call-decisions.json`,
`reputation.json`, `datasets/`). Um vetor novo que quebra uma plataforma bloqueia o merge.

## Consequências

- Divergência entre plataformas vira teste falhando, não bug em produção.
- Mudança de regra = PR em `data/` + vetores, revisado pelo BRAZIL_TELECOM_AGENT.
- Custo: manter 3 implementações pequenas (normalizador, leitor de shard, verificador).
