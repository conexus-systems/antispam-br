# AntiSpam BR 🛡️

**Bloqueio de ligações de spam, robocalls e golpes — gratuito, open source, privacy-first e feito para o Brasil.**

- Decide **no aparelho**, sem depender de internet durante a ligação.
- Entende `+55`, DDD, nono dígito, `0303`, `0800`, `4004`; emergência e utilidade pública (1XX, 112, 911) **nunca** são bloqueadas.
- Toda decisão é **explicável** ("por que bloqueou?") e reversível com um toque ("Não é spam").
- Base comunitária transparente, publicada em datasets **assinados**; uma denúncia sozinha nunca bloqueia ninguém.
- Sem anúncios, sem conta, sem venda de dados, sem upload da agenda.

> Nome provisório. Doação opcional via PIX ([DONATE.md](DONATE.md)).

## Estado

| Marco | Status |
|---|---|
| M0 — pesquisa, ADRs, arquitetura, threat model | ✅ |
| M1 — Android nativo offline | 🟡 núcleo pronto e validado em emulador (78 testes JVM + 3 instrumentados) |
| M2 — comunidade + API PostgreSQL | ✅ API (envio pelo Android pendente) |
| M6 — iOS | 🔜 |

Detalhes em [docs/ROADMAP.md](docs/ROADMAP.md).

## Estrutura

```
apps/android/      app nativo (Kotlin, Compose, CallScreeningService) + :engine (motor puro)
apps/ios/          extensões iOS (Message Filter hoje; Call Directory em M6)
apps/web/          portal comunitário
apps/legacy-expo/  protótipo React Native anterior — congelado (ADR 0001)
packages/          phone-normalizer, datasets (formato binário assinado), reputation — TypeScript
services/api/      API comunitária (PostgreSQL) — ver services/api/README.md
data/              regras BR, schemas, vetores de teste normativos, corpus SMS anonimizado
docs/              ARCHITECTURE, THREAT_MODEL, ROADMAP, adr/, specs/, research/
agents/            papéis da equipe de agentes (ROLE / TASKS / DECISIONS)
```

## Rodando

Requisitos: JDK 17, Android SDK (API 36), Node ≥ 22.18.

```bash
# pacotes TS e vetores compartilhados
npm ci && npm test && npm run typecheck

# API comunitária + portal (Postgres em 127.0.0.1:5544, API em http://127.0.0.1:17887)
docker compose -f infra/docker/docker-compose.yml up -d --build
TEST_DATABASE_URL=postgres://antispam:antispam-dev-only@127.0.0.1:5544/antispam npm run test:api

# Android
cd apps/android
./gradlew :engine:test            # motor + vetores compartilhados
./gradlew :app:installDebug       # instala com.conexus.antispam.debug
adb shell cmd role add-role-holder android.app.role.CALL_SCREENING com.conexus.antispam.debug
```

O build debug baixa datasets de `http://10.0.2.2:17887/datasets/br-calls/` e confia na chave de
**teste** (`data/test-vectors/datasets/TEST_KEY.json`). Para servir os vetores localmente:

```bash
mkdir -p /tmp/www/datasets && cp -r data/test-vectors/datasets/v2 /tmp/www/datasets/br-calls
python3 -m http.server 17887 --bind 127.0.0.1 --directory /tmp/www
```

Builds release só aceitam chaves passadas em `-Pantispam.datasetKeys=id:base64` e recusam `test-*`.

### Publicação na Google Play

A chave de upload e a conta de serviço ficam fora do repositório (`~/secrets/`).

```bash
cd apps/android
./gradlew :engine:test :app:lintRelease :app:bundleRelease \
  -Pantispam.signingProperties=$HOME/secrets/antispam-br-upload.properties \
  -Pantispam.versionCode=3 -Pantispam.versionName=0.1.2
cd ../..
GOOGLE_PLAY_SERVICE_ACCOUNT=$HOME/secrets/google-play-service-account.json \
  node apps/android/scripts/play-upload.ts --aab apps/android/app/build/outputs/bundle/release/app-release.aab --track internal
```

Enquanto o app estiver em rascunho na Console, só releases `draft` são aceitas. Ficha da loja: `apps/android/play/listing-pt-BR.md`;
ícone 512 e feature graphic: `apps/android/play/graphics/`. Visual e identidade: [docs/DESIGN.md](docs/DESIGN.md).

## Privacidade

Nada da agenda, do histórico ou de conteúdo de SMS sai do aparelho. O app não pede permissão de
contatos — assim o Android nem envia ligações de contatos para triagem. Telemetria é opt-in.
Ver [docs/PRIVACY.md](docs/PRIVACY.md) e [docs/adr/0004-number-privacy.md](docs/adr/0004-number-privacy.md).

## Licença

MIT — [LICENSE](LICENSE). Contribua: [CONTRIBUTING.md](CONTRIBUTING.md) · Segurança: [SECURITY.md](SECURITY.md)
