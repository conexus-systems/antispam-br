# Especificação — Dataset de reputação `br-calls` (format v1)

Normativo. Implementações: `packages/datasets` (TS, escrita+leitura), `apps/android/engine`
(Kotlin, leitura+verificação), `apps/ios` (Swift, leitura+verificação). Vetores:
`data/test-vectors/datasets/`.

## 1. Layout publicado

```
datasets/br-calls/
  manifest.json            # metadados (UTF-8, JSON)
  manifest.json.sig        # assinatura Ed25519 dos bytes exatos de manifest.json, base64 (sem quebra de linha)
  brazil/
    55-11.bin.gz           # shard completo do DDD 11
    55-21.bin.gz
    55-ng.bin.gz           # números não geográficos (0800, 0300, 0303, 0500, 0900, 4004, 3003…)
    55-intl.bin.gz         # (reservado) números internacionais vistos no Brasil
    deltas/
      55-11.2026100600-2026100700.bin.gz
```

## 2. Manifest

```json
{
  "schema_version": 1,
  "dataset": "br-calls",
  "version": 2026100700,
  "created_at": "2026-10-07T00:00:00Z",
  "expires_at": "2026-10-21T00:00:00Z",
  "key_id": "asbr-2026a",
  "compression": "gzip",
  "record_count": 12345,
  "publication_policy": { "min_weighted_reporters": 3, "min_age_hours": 48, "min_score": 60 },
  "shards": [
    { "id": "55-11", "path": "brazil/55-11.bin.gz", "version": 2026100700,
      "sha256": "<hex>", "size": 1234, "record_count": 77 }
  ],
  "deltas": [
    { "shard": "55-11", "from_version": 2026100600, "to_version": 2026100700,
      "path": "brazil/deltas/55-11.2026100600-2026100700.bin.gz",
      "sha256": "<hex>", "size": 210, "record_count": 9 }
  ]
}
```

Regras de validação do cliente (todas obrigatórias; falha em qualquer uma → dataset recusado,
versão anterior mantida):

1. `manifest.json.sig` verifica com uma das chaves públicas embarcadas cujo id == `key_id`.
2. `schema_version == 1` e `dataset == "br-calls"`.
3. `version > versão instalada` (anti-rollback). Igual = nada a fazer.
4. `now < expires_at` (anti-freeze: servidor comprometido não consegue congelar clientes numa
   versão velha para sempre). Manifest vencido → manter dados atuais, avisar na UI.
5. `compression` suportada (`gzip` na v1).
6. Todo `path` casa `^brazil/(deltas/)?[a-z0-9.-]+\.bin\.gz$` (sem `..`, sem absoluto).
7. Cada arquivo baixado: `size` e `sha256` (dos bytes **comprimidos**) conferem.
8. Arquivo descomprimido: header válido, `record_count` confere com manifest e header,
   tamanho == 32 + 16 × record_count, números estritamente crescentes.
9. Shard completo não contém `TOMBSTONE`.
10. Delta só é aplicado se `from_version` == versão instalada **daquele shard**; caso contrário
    baixar o shard completo.

Troca é atômica: escrever em diretório temporário, validar tudo, renomear.

## 3. Arquivo binário (após gunzip), big-endian

### Header — 32 bytes

| Offset | Tamanho | Campo | Valor |
|---|---|---|---|
| 0 | 4 | magic | ASCII `ASBR` |
| 4 | 1 | format_version | `1` |
| 5 | 1 | kind | `0` = FULL, `1` = DELTA |
| 6 | 2 | reserved | `0` |
| 8 | 4 | record_count | u32 |
| 12 | 4 | reserved | `0` |
| 16 | 8 | version | u64 (versão do shard/delta de destino) |
| 24 | 8 | from_version | u64 (`0` para FULL) |

### Registro — 16 bytes

| Offset | Tamanho | Campo | Semântica |
|---|---|---|---|
| 0 | 8 | number | u64, dígitos E.164 sem `+` (ex.: `5511987654321`) |
| 8 | 1 | score | 0–100 |
| 9 | 1 | category | código da tabela §4 |
| 10 | 1 | confidence | 0–100 |
| 11 | 1 | flags | bit0 `TOMBSTONE`, bit1 `CAMPAIGN`, bit2 `DISPUTED`, bit3 `VERIFIED_ORG`, bits 4–7 reservados (0) |
| 12 | 2 | reporters | u16, denunciantes distintos ponderados (arredondado, saturado em 65535) |
| 14 | 2 | last_seen_day | u16, dias desde 2020-01-01 UTC |

Registros ordenados por `number` estritamente crescente → busca binária direta sobre o
arquivo mapeado (`O(log n)`, sem alocação). Mesma ordem exigida pelo iOS Call Directory.

## 4. Códigos de categoria

| Código | Categoria | Código | Categoria |
|---|---|---|---|
| 0 | OTHER | 7 | PHISHING |
| 1 | TELEMARKETING | 8 | DELIVERY_SCAM |
| 2 | ROBOCALL | 9 | FAKE_SUPPORT |
| 3 | SILENT_CALL | 10 | LOAN |
| 4 | COLLECTION | 11 | SURVEY |
| 5 | BANK_SCAM | 12 | SPOOFING |
| 6 | PIX_SCAM | 13 | LEGITIMATE |

Código desconhecido → tratar como OTHER (compatibilidade futura).

## 5. Shard de um número

- `+55` + DDD geográfico (11–99) → `55-<DDD>`.
- `+55` não geográfico (`0800`, `0300`, `0303`, `0500`, `0900`, `3003`, `4003`, `4004`,
  `4020`… armazenados como `55` + número sem zero inicial, ex.: `0800 123 4567` → `558001234567`) → `55-ng`.
- Fora do Brasil → `55-intl` (reservado).

## 6. Chaves

- Ed25519 (RFC 8032). Chave pública embarcada no app como base64 de 32 bytes, por `key_id`.
- Rotação: publicar com a chave nova somente após uma release de app contendo ambas.
- Chave de teste (pública **e** privada) em `data/test-vectors/datasets/TEST_KEY.json` —
  **nunca** aceita em builds release.
