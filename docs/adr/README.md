# Architecture Decision Records

Formato: contexto → decisão → consequências. ADR aceito só muda por outro ADR que o substitua.

| # | Título | Status |
|---|---|---|
| [0001](0001-native-first.md) | Apps nativos (Kotlin / Swift); protótipo Expo congelado | Aceito |
| [0002](0002-shared-intelligence-via-data.md) | Inteligência compartilhada por dados + vetores de teste, não por código | Aceito |
| [0003](0003-dataset-format.md) | Formato de dataset: shards por DDD, registros binários ordenados, manifest assinado Ed25519 | Aceito |
| [0004](0004-number-privacy.md) | Números publicados em claro sob política de publicação; consultas por hash-prefix | Aceito |
| [0005](0005-decision-pipeline.md) | Pipeline de decisão on-device, fail-open, BLOCK exige evidência forte | Aceito |
| [0006](0006-reputation-and-anti-poisoning.md) | Reputação 0–100 com pesos por denunciante e quarentena | Aceito |
| [0007](0007-backend-stack.md) | Backend TypeScript (Node 22) + PostgreSQL 16 | Aceito |
| [0008](0008-sms-on-android.md) | SMS no Android: análise por compartilhamento, sem permissão de SMS no MVP | Aceito |
