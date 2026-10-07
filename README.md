# AntiSpam BR 🛡️

**Bloqueio inteligente de chamadas de spam — 100% open source, sem anúncios, sem cadastro, privacy-first.**

Feito para o Brasil: entende `+55`, DDD, 9º dígito, `0800`, `0303`, `4004/3003`, emergências (que **nunca** são bloqueadas), e toma decisões **explicáveis** em **< 100 ms**, totalmente **offline**.

> ⚠️ Nome provisório. Monetização: **nenhuma** — doação opcional via PIX (chave via env de build, nunca no código).

---

## ✨ O que já funciona (MVP)

| Funcionalidade | Status |
|---|---|
| Motor de decisão local (`ALLOW / WARN / SILENCE / BLOCK`) com fail-safe | ✅ 42 testes |
| Normalização BR (`(11) 99999-9999` ≡ `11999999999` ≡ `+5511999999999`) | ✅ |
| SpamScore 0–100 auditável (reputação + campanha + padrão + STIR/SHAKEN + histórico) | ✅ |
| Modos: Desativado / Básico / Equilibrado / Agressivo / Personalizado | ✅ |
| Whitelist, blacklist, regras por prefixo/regex/ocultos/internacionais | ✅ |
| Emergências (190, 192, 193…) e contatos: **nunca bloqueados** | ✅ |
| Denúncias locais com anti-abuse (denunciantes únicos, recência, falso-positivos) | ✅ |
| Detecção de campanhas (dezenas de números similares em 10 min) | ✅ |
| Histórico explicável ("por que bloqueou?") + tempo poupado (estimativa) | ✅ |
| Verificar número (antes de retornar ligação suspeita) | ✅ |
| IA Assistente opcional via **OpenRouter** (off por padrão, **nunca** decide bloqueio) | ✅ |
| Backup JSON validado (anti-payload-malicioso) | ✅ |
| Doação PIX com BR Code gerado no aparelho (CRC16/EMV) | ✅ |
| Simulador de chamadas (funciona no Expo Go, iOS e Android) | ✅ |
| **CallScreeningService real (Android 10+)** — módulo Expo local, papel ROLE_CALL_SCREENING, fail-safe, timeout 1,2 s, cache | ✅ dev build/standalone |
| APK standalone (JS embutido, sem Expo Go) instalado e validado em device | ✅ |
| iOS (Call Directory Extension) | 🔜 ver [Roadmap](docs/ROADMAP.md) |

## 🚀 Rodando

```bash
npm install
npx expo start          # escaneie o QR com Expo Go (iOS/Android)
```

- **Expo Go**: tudo funciona em **modo demonstração** — use o **Simulador de chamadas** na aba Início para ver o pipeline completo (normalização → regras → base → score → decisão → histórico → denúncia).
- **Bloqueio real (Android)**: build standalone com o módulo nativo integrado (M2 ✅):

```bash
npx expo prebuild --platform android
cd android && ./gradlew :app:assembleRelease   # APK com JS embutido, sem Expo Go
adb install -r app/build/outputs/apk/release/app-release.apk
```

No primeiro uso, conceda o papel de **ID de chamada e spam** (Configurações → Apps → Apps padrão) ou aceite o diálogo do app. Sem o papel, o serviço não é invocado; com ele, chamadas recebidas passam pelo motor local offline. Falha do pipeline → ALLOW (nunca bloqueia por erro).
- **iOS**: equivalente é a Call Directory Extension — planejado (M2, ver roadmap).

## 🧪 Testes

```bash
npm test          # 44 testes do motor crítico
npm run typecheck # TypeScript estrito
npm run e2e       # E2E ponta a ponta no Expo Go (emulador headless Android)
```

O E2E (`scripts/e2e-expo-go.sh`) sobe emulador + metro, instala o Expo Go (SDK 57),
dispara 5 chamadas simuladas via deep link `exp://…/--/simulate?number=…` e valida as
decisões (BLOCK/SILENCE/ALLOW) pelos logs `ReactNativeJS`. Requer `ANDROID_SDK_ROOT`
com AVD `test34` e o APK em `~/Downloads/ExpoGo.apk`.

## 🔐 Privacidade por design

- Processamento **100% local** por padrão; sem conta, sem telemetria, sem anúncios.
- Contatos/histórico **nunca** saem do aparelho.
- A única rede opcional é a **IA Assistente** (você fornece a chave OpenRouter; envia apenas o número que você pediu para analisar).
- Base comunitária (futuro) usará **hash-prefix / k-anonymity** — ver `docs/PRIVACY.md` e `docs/THREAT_MODEL.md`.

## 🗂️ Estrutura

```
app/                  # Telas (expo-router): onboarding, (tabs), donate
src/core/             # Motor puro e testável
  phone/              #   normalização BR + emergências + regras 0303
  detection/          #   SpamScore + CampaignDetector
  decision/           #   SpamDecisionEngine (pipeline §4)
  rules/              #   motor de regras do usuário
  reputation/         #   reputação local com anti-abuse
  database/           #   banco de spam (formato aberto) + seed
  security/           #   SHA-256 (hash-prefix privacy)
  donation/           #   PIX BR Code (EMV + CRC16)
  ai/                 #   cliente OpenRouter (opcional, off por padrão)
src/services/          # Store global, screening service, backup, ponte nativa
src/ui/               # Design system (tema + componentes)
native/android/       # Kotlin de referência (CallScreeningService)
docs/                 # RESEARCH, PRD, ARCHITECTURE, THREAT_MODEL, PRIVACY, ROADMAP…
__tests__/            # Testes do motor crítico (Jest)
```

## 🗺️ Próximos passos

Ver **[docs/ROADMAP.md](docs/ROADMAP.md)** — inclui a avaliação de viabilidade (técnica e legal) dos recursos avançados pedidos: SMS spam, "modo troll", gravação de áudio, geolocalização de originadores, cruzamento com dados públicos, integração OLX/Mercado Livre, e-mails/WhatsApp vinculados.

## 📄 Licença

MIT — veja [LICENSE](LICENSE). Contribua: [CONTRIBUTING.md](CONTRIBUTING.md) · Segurança: [SECURITY.md](SECURITY.md) · Doar: [DONATE.md](DONATE.md)
