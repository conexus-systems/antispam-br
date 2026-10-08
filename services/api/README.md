# @antispam-br/api — API comunitária (M2/M3)

Node 22 (TypeScript com type stripping, sem build) + PostgreSQL 16. Reputação calculada por
`packages/reputation` (ADR 0006), datasets gerados e assinados por `packages/datasets` (ADR 0003).
Nenhum IP, token ou número de quem denuncia é guardado em claro.

## Rodar (dev)

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build   # Postgres :5544 + API :17887
# ou, com um Postgres próprio:
DATABASE_URL=postgres://... SERVER_SECRET=$(openssl rand -hex 32) npm run migrate -w @antispam-br/api
DATABASE_URL=postgres://... SERVER_SECRET=... npm start -w @antispam-br/api
```

Testes (Postgres real, um schema isolado por arquivo):

```bash
TEST_DATABASE_URL=postgres://antispam:antispam-dev-only@127.0.0.1:5544/antispam npm run test:api
```

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---|---|
| `DATABASE_URL` | sim | Conexão Postgres |
| `SERVER_SECRET` | sim (≥ 32 chars) | HMAC de desafios PoW, refs de denúncia e hash de rede |
| `PORT` | não (8787) | Porta HTTP |
| `POW_BITS` | não (20) | Dificuldade da prova de trabalho no registro de dispositivo |
| `MODERATION_TOKENS` | não | `nome:token,nome2:token2`; sem isso as rotas de moderação respondem 404 |
| `TRUST_PROXY_HOPS` | não (0) | Quantos proxies confiáveis à frente; usa o N-ésimo IP do `X-Forwarded-For` pela direita |
| `CLIENT_IP_HEADER` | não | Cabeçalho de IP do proxy de borda (ex.: `cf-connecting-ip`) |
| `WEB_DIR` | não | Serve o portal estático (`apps/web`) na raiz |
| `DATASET_SIGNING_SEED_FILE` / `DATASET_KEY_ID` | só `publish` | Semente Ed25519 (32 bytes, base64) e id da chave |

Publicação de dataset (job isolado, chave fora do servidor da API):
`npm run publish-dataset -w @antispam-br/api`.

## Endpoints (v1)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/healthz` | Saúde (inclui banco) |
| GET | `/v1/devices/challenge` | Desafio PoW assinado (uso único) |
| POST | `/v1/devices` | Registra dispositivo pseudônimo; devolve token (guardado só como SHA-256) |
| GET | `/v1/numbers/{number}/reputation` | Reputação pública: neutra (`NOT_LISTED`) até ser publicável |
| GET | `/v1/reputation/hash-prefix/{prefix}` | Consulta k-anônima: só números publicados com o prefixo do SHA-256 |
| POST | `/v1/reports` | Denúncia (token + nonce + timestamp ±10 min); devolve `ref` opaco |
| POST | `/v1/reports/{ref}/vote` | `confirm` / `dispute` por referência HMAC (não enumerável) |
| POST | `/v1/numbers/{number}/legitimate` | Contestação "é legítimo" (vai para a fila de moderação) |
| GET | `/v1/campaigns` | Campanhas agregadas por bloco de 10 mil números (`+55119876XXXX`) |
| GET | `/v1/datasets/manifest` (+ `.sig`) | Manifest atual assinado |
| GET | `/v1/datasets/{version}` | Índice da versão; arquivos em `/v1/datasets/{version}/brazil/...` |
| GET/POST | `/v1/moderation/...` | Fila de contestações, decisão ACCEPT/REJECT, quarentena de dispositivo |

## Anti-poisoning (resumo; detalhes no ADR 0006)

- Uma denúncia nunca publica: exige Σw ≥ 3, 48 h de idade, score ≥ 60, ≥ 50 % de peso de
  dispositivos com ≥ 7 dias e ≥ 3 redes distintas.
- Peso por rede (/24 IPv4, /32 IPv6) limitado a 1: muitos dispositivos numa rede valem como um.
- Contestações de dispositivos com < 30 dias só somam até o peso das contestações mais antigas;
  suspensão por contestação pendente exige peso ≥ 0,5 de dispositivos com ≥ 7 dias, ao menos um
  com ≥ 30 dias, fora de quarentena.
- Dispositivo acima do p99 diário da frota perde o peso no dia; quarentena manual zera o peso.
- Rate limit por dispositivo, por rede (/24, /48) e por falhas de autenticação.
- Contestação aceita protege o número por 90 dias; recálculo por tempo roda de hora em hora.

## Não exposto (por design)

- Denúncias individuais, autores, contagens brutas por número ou comentários (só a moderação lê).
- Comentários são apagados após 90 dias; partições de denúncias após 14 meses.
