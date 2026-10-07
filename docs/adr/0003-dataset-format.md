# ADR 0003 — Formato de dataset

## Contexto

O app precisa decidir offline em milissegundos e o servidor não pode receber milhões de
consultas individuais. O iOS Call Directory exige números como `Int64` em ordem crescente.

## Decisão

Especificação completa: [`docs/specs/DATASET_FORMAT.md`](../specs/DATASET_FORMAT.md).

- **Shards por DDD** (`brazil/55-11.bin.gz`) + shard `55-ng` (não geográficos: 0800, 0300,
  0303, 4004…). Atualização baixa só o que mudou.
- **Registro binário fixo de 16 bytes**, ordenado pelo número E.164 como `u64` → busca binária
  em arquivo mapeado em memória, sem parse, sem índice extra; ordem compatível com o Call
  Directory.
- **Compressão gzip** na v1 (zero dependência nativa em Android/iOS/Node). O manifest declara
  `compression`; `zstd` pode entrar depois sem quebrar clientes antigos (eles ignoram shards
  que não sabem ler e mantêm a versão anterior).
- **Manifest JSON + assinatura destacada** (`manifest.json` + `manifest.json.sig`, Ed25519
  sobre os bytes exatos do arquivo). Evita canonicalização de JSON entre linguagens.
- Cada shard e delta tem `sha256`, `size` e `record_count` no manifest.
- **Anti-rollback / anti-freeze**: `version` inteiro monotônico; cliente recusa
  `version <= instalada` e manifest com `expires_at` vencido.
- **Delta updates**: arquivo com o mesmo layout, registros com flag `TOMBSTONE` removem.
  Cliente aplica delta só se `from_version == versão instalada do shard`; senão baixa o shard cheio.
- Chaves: até 2 chaves públicas embarcadas (`key_id`) para rotação sem quebrar clientes.

## Consequências

- 1 milhão de números ≈ 16 MB descomprimido; com top-N por shard no iOS.
- Formato trivial de implementar em Kotlin, Swift e TS (vetores em `data/test-vectors/datasets/`).
- Sem metadados textuais por número no dataset (sem comentários, sem nomes) — reduz risco de
  difamação e de vazamento.
