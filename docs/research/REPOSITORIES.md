# REPOSITÓRIOS DE REFERÊNCIA — AntiSpam BR

> **Data de verificação: 2026-10-07.** Metadados (licença SPDX, `pushed_at`, arquivado, linguagem,
> estrelas) obtidos via `gh api repos/OWNER/REPO` (GitHub), API do GitLab
> (`/api/v4/projects/...`) e API do Codeberg/Forgejo (`/api/v1/repos/...`). Arquitetura e técnicas
> vêm da leitura de README e arquivos-fonte citados (caminhos indicados). Licenças de F-Droid vêm de
> `gitlab.com/fdroid/fdroiddata/-/raw/master/metadata/<appId>.yml`.
> Onde algo não pôde ser confirmado está escrito **"não verificado"**. Nada aqui é estimativa.
>
> Regra de reuso (detalhe em [`../LEGAL_AND_LICENSE_REVIEW.md`](../LEGAL_AND_LICENSE_REVIEW.md)):
> **MIT/BSD/ISC** → código reutilizável com atribuição · **Apache-2.0** → reutilizável com
> LICENSE + NOTICE · **MPL-2.0** → reutilizável por arquivo (arquivo modificado continua MPL) ·
> **GPL/AGPL/LGPL, CC-NC, sem licença** → **somente ideias**, nunca copiar código.

## 0. Resumo

| # | Projeto | Plataforma | Licença | Última atividade | Arquivado | ★ | Reuso de código |
|---|---|---|---|---|---|---|---|
| 1 | [aj3423/SpamBlocker](https://github.com/aj3423/SpamBlocker) | Android | MIT | 2026-10-03 | não | 1888 | ✅ c/ atribuição |
| 2 | [SysAdminDoc/CallShield](https://github.com/SysAdminDoc/CallShield) | Android + Worker | MIT (dados: mistos) | 2026-10-07 | não | 44 | ✅ código; ⚠️ dados |
| 3 | [jhonsu01/OpenCallShield](https://github.com/jhonsu01/OpenCallShield) | Android | MIT | 2026-10-02 | não | 5 | ✅ c/ atribuição |
| 4 | [ryosoftware/calls-blocker](https://github.com/ryosoftware/calls-blocker) | Android | CC BY-NC-SA 4.0 (GitHub: NOASSERTION) | 2026-09-26 | não | 9 | ❌ (NC, não-OSI) |
| 5 | [keyvisions/CallScreener](https://github.com/keyvisions/CallScreener) | Android | GPL-3.0 | 2026-01-20 | não | 0 | ❌ ideias |
| 6 | [khrlagst/stranger-call-blocker](https://github.com/khrlagst/stranger-call-blocker) | Android | MIT (app) + Apache-2.0 (`sb-engine-*`) | 2026-08-30 | não | 1 | ✅ |
| 7 | [chrisballinger/OpenCallBlock](https://github.com/chrisballinger/OpenCallBlock) | iOS | MPL-2.0 | 2018-12-01 | não (inativo) | 81 | ✅ por arquivo |
| 8 | [damankarora/ios-spam-call-blocker](https://github.com/damankarora/ios-spam-call-blocker) | iOS | **sem licença** | 2026-07-17 | não | 0 | ❌ todos os direitos reservados |
| 9 | [xynngh/YetAnotherCallBlocker](https://gitlab.com/xynngh/YetAnotherCallBlocker) (GitLab) | Android | AGPL-3.0-only | 2026-09-30 | não | 146 (GitLab) | ❌ ideias |
| 10 | [cbouvat/saracroche-android](https://codeberg.org/cbouvat/saracroche-android) (Codeberg) | Android | GPL-3.0 | 2026-10-01 | não (espelho GitHub arquivado) | 113 (Codeberg) / 183 (GitHub) | ❌ ideias |
| 11 | [cbouvat/saracroche-ios](https://codeberg.org/cbouvat/saracroche-ios) (Codeberg) | iOS | GPL-3.0 | 2026-09-17 | não (espelho GitHub arquivado) | 37 / 139 | ❌ ideias |
| 12 | [adamff-dev/spam-call-blocker-app](https://github.com/adamff-dev/spam-call-blocker-app) | Android | GPL-3.0 | 2026-09-12 | não | 211 | ❌ ideias |
| 13 | [Divested-Mobile/Carrion](https://github.com/Divested-Mobile/Carrion) | Android | AGPL-3.0 (F-Droid: AGPL-3.0-or-later) | 2025-08-28 | **sim** (movido p/ GitLab) | 48 | ❌ ideias |
| 14 | [afterxleep/Bouncer](https://github.com/afterxleep/Bouncer) | iOS (SMS) | MIT | 2026-10-07 | não | 408 | ✅ c/ atribuição |
| 15 | [ffimnsr/spam-sniper](https://github.com/ffimnsr/spam-sniper) | iOS | MIT (GitHub: NOASSERTION; dep. ObjectivePGP não-comercial) | 2026-06-18 | não | 3 | ✅ código próprio; ❌ ObjectivePGP |
| 16 | [apple/pir-service-example](https://github.com/apple/pir-service-example) (ex-`live-caller-id-lookup-example`) | Servidor Swift | Apache-2.0 | 2026-10-01 | não | 220 | ✅ c/ NOTICE |
| 17 | [apple/swift-homomorphic-encryption](https://github.com/apple/swift-homomorphic-encryption) | Lib Swift | Apache-2.0 | 2026-10-07 | não | 661 | ✅ c/ NOTICE |
| 18 | [CallerAPI/Falcon](https://github.com/CallerAPI/Falcon) | Servidor SIP (Go) | Apache-2.0 | 2026-10-07 | não | 5 | ✅ c/ NOTICE |
| 19 | [signalwire/libstirshaken](https://github.com/signalwire/libstirshaken) | Lib C | MIT | 2024-08-22 | não | 38 | ✅ |
| 20 | [asipto/secsipidx](https://github.com/asipto/secsipidx) | Lib/CLI Go | BSD-3-Clause-Clear | 2026-04-18 | não | 54 | ✅ (sem licença de patente) |
| 21 | [FossifyOrg/Phone](https://github.com/FossifyOrg/Phone) | Android (discador) | GPL-3.0 | 2026-10-03 | não | 1352 | ❌ ideias |
| 22 | [google/libphonenumber](https://github.com/google/libphonenumber) | Lib Java/C++/JS | Apache-2.0 | 2026-10-07 | não | 18300 | ✅ dependência |
| 23 | [Phishing-Database/Phishing.Database](https://github.com/mitchellkrogza/Phishing.Database) | Feed de dados | MIT | 2026-10-02 | não | 1624 | ✅ dados c/ atribuição |
| 24 | [emxsys/callattendant](https://github.com/emxsys/callattendant) | Raspberry Pi (Python) | MIT | 2023-02-01 | não (inativo) | 126 | ✅ |

Não encontrados / não verificados:

- `xynngh/YetAnotherCallBlocker` **não existe no GitHub** (HTTP 404); o projeto vive no GitLab (#9).
- `apple/live-caller-id-lookup-example` redireciona para `apple/pir-service-example` (renomeado).
- `bitfireAT/NoPhoneSpam` (NoPhoneSpam original): **repo não encontrado** no GitHub (404) e pacote
  `at.bitfire.nophonespam` não encontrado na API do F-Droid. Existem forks GPL-3.0
  (ex.: [joseluu/NoPhoneSpam](https://github.com/joseluu/NoPhoneSpam), push 2026-09-12) — não analisados.
- Busca por `ILMessageFilterExtension`, "spam sms brasil", "spam call brazil": **nenhum projeto
  open-source brasileiro relevante** encontrado (só protótipos com 0–1 ★, ex. `juka700/Golpe-SMS`,
  sem licença).

---

## 1. aj3423/SpamBlocker — referência nº 1 de funcionalidades Android

- **URL:** https://github.com/aj3423/SpamBlocker · F-Droid `spam.blocker` (licença MIT no fdroiddata, sem anti-features).
- **Licença:** MIT (LICENSE verificado). ⚠️ A versão anterior deste documento dizia GPL-3.0 — **estava errada**.
- **Atividade:** push 2026-10-03 · Kotlin (1,45 MB) + Java (365 KB) · 1888 ★ · não arquivado.
- **Arquitetura:** app único Android 10+; `service/CallScreeningService.kt`, `SmsReceiver.kt`,
  `WapPushReceiver.kt`, `NotificationListenerService.kt`, `PublicSMSScreeningService.kt` (protocolo
  próprio de "SMS screening provider" que nenhum app de SMS implementa ainda). Motor em
  `service/checker/Checker.kt` (1917 linhas): interface `IChecker` com `priority()`; checkers
  ordenados por prioridade desc.; detecção de **conflito de prioridade** (mesma prioridade com
  allow e block).
- **Recursos:** contatos, grupo de contatos, prefixo de contato, STIR/SHAKEN, chamadas repetidas,
  número discado, número atendido, emergência (libera após ligar 911), "Push Alert" (libera chamada
  após notificação de outro app, ex. entregador), "SMS Alert", SMS bomb (flood de OTP), apps
  recentes, modo reunião, horário livre, spam DB, **IA local** (treino de filtro SMS), agenda e
  calendário, geolocalização/operadora, **Instant Query** (consulta paralela a várias APIs, ex.
  PhoneBlock), reportar spam, regex com templates.
- **Técnicas interessantes:** `util/ComplementNaiveBayes.kt` (Complement Naive Bayes incremental,
  vocabulário ≤ 50k, modelo 1–2 MB); `util/Formula.kt`; workflows/automação (`service/bot/*`:
  triggers, actions, schedule); `SpamTable` com `importReason` e expiração por timestamp
  (`deleteBeforeTimestamp`); **build sem permissão INTERNET** gerada no CI
  (`.github/workflows` remove `android.permission.INTERNET` do manifest e publica APK separado);
  flavors `fdroid` e `googleplay`; **APK reprodutível** (F-Droid Reproducible Builds) e hash do
  certificado publicado no README.
- **Banco:** SQLite cru via `SQLiteOpenHelper` (`db/Db.kt`), tabelas `SpamTable`, `RegexTable`,
  `BayesTable`, `HistoryTable`, `BotTable`, `ApiTable`.
- **Reputação:** não há score comunitário próprio; spam DB = listas baixáveis (ex. FTC DNC) + APIs
  de terceiros. Ideia em aberto: [banco descentralizado (#340)](https://github.com/aj3423/SpamBlocker/issues/340).
- **Atualização:** download de bases por workflow agendado; consulta online opcional.
- **Privacidade:** offline = zero coleta; online expõe IP, fingerprint TLS/TCP e número
  reportado (declarado no README).
- **Testes:** 5 testes instrumentados (`androidTest`: `DbSchemaTest`, `RuleTest`,
  `BayesTokenizerTest`, `FormulaTest`, `ScheduleTest`); CI `test.yml` só compila os flavors.
- **Segurança:** reprodutibilidade + assinatura publicada. Permissões amplas (`READ_SMS`,
  `READ_CALL_LOG`, `PACKAGE_USAGE_STATS`, `SYSTEM_ALERT_WINDOW`…) — inviável na Play sem exceção.
- **i18n:** 17 locales incluindo `values-pt-rBR` (traduções por IA, segundo o README).
- **Reutilizável (MIT):** `ComplementNaiveBayes.kt`/`BayesTokenizer` (classificador SMS on-device),
  padrão `IChecker`+prioridade+detector de conflito, `Schedule`, truque do flavor sem INTERNET.

## 2. SysAdminDoc/CallShield — referência nº 1 de pipeline de dados assinados

- **URL:** https://github.com/SysAdminDoc/CallShield · distribuído só via GitHub Releases/Obtainium
  (README: "no Google Play or F-Droid listing and none is planned").
- **Licença:** MIT (código). **Dados mistos**: o README declara que faixas importadas do Saracroche
  são **CC BY-NC-SA 4.0** e que listas recomendadas incluem GPL-2.0 (SpamChile) e GPL-3.0
  (Turkish Spam Numbers); amostra IMC 2025 de smishing em testes é CC BY 4.0.
- **Atividade:** push 2026-10-07 · Kotlin · 44 ★.
- **Arquitetura:** app Android 10+ (Compose, Room 10 entidades, WorkManager, OkHttp com pinning,
  Moshi) + **Cloudflare Worker** (`worker/community-reports-worker.js`) para denúncias + pipeline
  Python (`scripts/import_all_sources.py`, `merge_community_reports.py`, `feed_signing.py`).
  Repositório GitHub é a "CDN" (raw + espelho jsDelivr opcional).
- **Recursos:** 30+ camadas `IChecker` com prioridades estáveis (11000 emergência … 1500 modo
  reunião); piso de OTP (nunca marca SMS com código); STIR/SHAKEN falhou → bloqueia, autenticado →
  libera heurística; prefixos regulatórios opt-in (**Brasil 0303/ANATEL**, Espanha 400, Índia 140);
  "Expecting a call"; allow temporário; prefix expansion de vizinhos; campanha/burst por NPA-NXX;
  ML; filtro RCS via Notification Access; checagem de chamada **de saída** (call redirection
  role) para número visto em SMS de golpe; aviso "não leia o código" quando chega OTP durante
  chamada de desconhecido; overlay de caller ID; tom SIT.
- **Técnicas interessantes:**
  - **Datasets assinados:** manifest + **256 shards endereçados por conteúdo** (1º byte do hash),
    cada um com `sha256`, `bytes`, `numbers`; cliente baixa só shards alterados, valida contra o
    manifest e faz refresh transacional no Room; fallback para snapshot legado
    (`data/README.md`). Assinatura destacada **ECDSA P-256** (`SHA256withECDSA`) sobre os bytes
    exatos, **2 chaves embarcadas (1 offline de backup)** — `data/remote/FeedSignature.kt`.
    Motivação documentada: pinning TLS quebrou por 7 semanas quando o GitHub trocou certificado.
  - **Anti-poisoning:** "Not spam" nunca remove sozinho — vira candidato a revisão; hot list exige
    4 denúncias em ≥ 2 h de 3 denunciantes no mesmo dia UTC; IDs de denunciante = **HMAC com chave
    diária do /48 e /64 IPv6** (não linkáveis entre dias); rate limit 5/min por cliente, 20 por /48,
    30 global; corroboração aceita no máx. dois /64 de um /48; corpo > 10 KB recusado.
  - **Proveniência de fontes:** `data/source-manifest.json` (modo de acesso, geografia,
    **licença**, atribuição, política de redistribuição, janela de frescor) +
    `source-freshness.json` + workflow semanal "pipeline liveness".
  - Evidência com expiração (1 ano para queixas); "APK privacy gate" (só 5 feeds no APK);
    SBOM CycloneDX + verificação de lockfile; recuperação de DB corrompido preservando regras do usuário.
  - ML: gradient-boosted trees (50 árvores, 20 features) em Kotlin puro, gate de F1 ≥ 0,45 em holdout.
  - Corpus SMS de regressão próprio (CC0) com variantes adversariais (zero-width, homoglifos
    cirílicos, fullwidth) — recall/precisão por idioma.
- **Banco:** Room/SQLite no device; JSON/TXT/shards no repositório.
- **Reputação:** fontes importadas (FCC ≥ 2 queixas, FTC DNC, revisados à mão) + comunidade
  corroborada; decaimento por idade da evidência.
- **Atualização:** DB a cada 6 h, trending a cada 30 min, catálogo de listas assinado.
- **Privacidade:** denúncias viram JSON público em `data/reports` (número, tipo, hora, id aleatório,
  dois HMAC diários); nunca texto de SMS (só domínios). Enriquecimento online desligado por padrão.
- **Testes:** README declara **1831 testes JVM** (Robolectric); 252 arquivos de teste na árvore;
  testes do Worker (node) e do pipeline (python).
- **Segurança:** cleartext off, backup em nuvem só de settings não secretos, mirror direct-boot.
  Incidente documentado: perda da senha do keystore → rotação de chave (v1.7.37).
- **i18n:** inglês + `zh-rCN` apenas; **sem pt-BR**.
- **Reutilizável (MIT):** `FeedSignature.kt` (padrão), formato manifest+shards, regras de
  corroboração, HMAC de rede rotativo, `source-manifest` com licença por fonte, corpus adversarial.
  ⚠️ **Não importar o dataset deles em bloco** (contém dados NC-SA e GPL).

## 3. jhonsu01/OpenCallShield — base colaborativa via GitHub (América Latina)

- **URL:** https://github.com/jhonsu01/OpenCallShield · Google Play `com.jhonsu01.opencallshield`.
- **Licença:** MIT · push 2026-10-02 · Kotlin · 5 ★.
- **Arquitetura:** MVVM, Compose, Room, WorkManager; `engine/SpamDetector.kt` determinístico
  (contato → permitir; DB → bloquear; prefixo → bloquear; desconhecido/oculto → bloquear se ativado).
- **Recursos:** rejeitar ou silenciar, prefixos, sync diário de `spam_numbers.json`
  (formato `{version, updated_at, numbers:[{number, reports, tag}]}`; 813 entradas em 2026-10-07,
  incluindo números colombianos em formato local `033…`).
- **Técnica interessante:** contribuição sem backend — login GitHub (OAuth Device Flow ou PAT
  guardado em `EncryptedSharedPreferences`) abre **Issue** com JSON; maintainer aplica label
  `aprovado` e a Action `integrate-spam.yml` funde no JSON (soma reports, dedup) e fecha a issue.
- **Reputação:** contagem bruta de reports, sem peso por denunciante. **Sem anti-poisoning.**
- **Atualização:** JSON inteiro diário; **sem assinatura**, sem delta.
- **Privacidade:** contribuir exige conta GitHub (identidade pública vinculada à denúncia).
- **Testes:** nenhum arquivo de teste; CI só compila.
- **Reutilizável:** fluxo Issue→label→Action como canal de moderação de baixo custo (ideia; código MIT).

## 4. ryosoftware/calls-blocker

- **URL:** https://github.com/ryosoftware/calls-blocker · push 2026-09-26 · Kotlin · 9 ★.
- **Licença:** `LICENSE.md` = **Creative Commons BY-NC-SA 4.0** (GitHub mostra NOASSERTION).
  Não é licença OSI/FSF de software; cláusula NC incompatível com MIT → **não reutilizar código**.
- **Arquitetura:** MVVM + Repository, **Hilt**, Room/KSP, WorkManager, **libphonenumber**,
  kotlinx-serialization; minSdk 30.
- **Recursos:** listas exata/prefixo, bloquear desconhecido/oculto/internacional (whitelist de
  países), grupo de contatos, "nunca liguei", repetição, agenda, **Find My Phone** (número
  confiável dispara alarme), tile, histórico CSV, backup JSON, **"Test Screening"** (simula decisão
  para um número), sugestões de bloqueio por notificação.
- **Reputação/comunidade:** nenhuma. **Testes:** nenhum. **Privacidade:** on-device.
- **Ideias aproveitáveis:** tela "testar número" e Find My Phone (conceito).

## 5. keyvisions/CallScreener

- **URL:** https://github.com/keyvisions/CallScreener · **GPL-3.0** · push 2026-01-20 · Kotlin · 0 ★.
- **Arquitetura:** `engine/RulesEngine.kt` + `service/CallScreeningService.kt` + Room + Compose.
- **Recursos:** blacklist, whitelist, **regex**, exceção por contatos; ações Allow/Silence/Reject;
  log mostra qual regra casou; ação padrão configurável.
- **Privacidade:** **sem permissão INTERNET** (forte garantia verificável).
- **Atenção:** pede `READ_CALL_LOG` (desnecessário para screening — ver LEGAL §6).
- **Testes:** nenhum na árvore. **Reuso:** só ideia ("qual regra casou" no log).

## 6. khrlagst/stranger-call-blocker — motor extraído em módulo Apache-2.0

- **URL:** https://github.com/khrlagst/stranger-call-blocker · push 2026-08-30 · Kotlin · 1 ★.
- **Licença:** app MIT; módulos `sb-engine-core` e `sb-engine-android` **Apache-2.0**
  (SPDX header nos arquivos; `LICENSE.commercial` é só oferta de suporte/SLA, não restringe uso).
- **Arquitetura:** `sb-engine-core` (lógica pura: `NumberRules`, `PatternLearner`, `SmsClassifier`,
  `SpamLabel`, `CallDecision`) + `sb-engine-android` (Room, repos, fachada `SbEngine`) + app.
- **Técnica interessante:** `PatternLearner` — **maior prefixo comum** (≥ 8 dígitos, deixando ≥ 2
  dígitos de cauda) compartilhado por ≥ 2 números bloqueados vira padrão de campanha.
- **Recursos:** silenciar desconhecidos, bloqueio SMS via broadcast + dismiss de notificação
  (Android 11+), rótulos Spam/Scam/Telemarketer/Promo, controles para WhatsApp (oculto/VoIP),
  OTA via GitHub com verificação de assinatura.
- **Privacidade:** nada sai do device (exceto checagem de release); backup desabilitado.
  Guarda o **corpo dos SMS bloqueados** localmente.
- **Testes:** 5 arquivos (`NumberRulesTest`, `PatternLearnerTest`, `SmsClassifierTest`, …).
- **Segurança:** `REQUEST_INSTALL_PACKAGES` (auto-update) — incompatível com Play/F-Droid policy.
- **Reutilizável (Apache-2.0):** `PatternLearner` (com NOTICE), separação core puro × Android.

## 7. chrisballinger/OpenCallBlock — Call Directory com faixas NPA-NXX

- **URL:** https://github.com/chrisballinger/OpenCallBlock · **MPL-2.0** · push **2018-12-01**
  (inativo, "Under Construction") · Swift · 81 ★.
- **Arquitetura:** app + `CallDirectoryExtension/CallDirectoryHandler.swift` + `CallDataKit`
  (YapDatabase) compartilhado por App Group; teste mínimo (`CallDataKitTests`, `OpenCallBlockTests`).
- **Técnica:** gera os 10 000 números de um prefixo NPA-NXX ("neighbor spoofing") e libera contatos.
- **Reuso:** MPL-2.0 permite usar arquivos (modificações nesses arquivos ficam MPL). Valor baixo —
  código de 2018; preferir implementação própria.

## 8. damankarora/ios-spam-call-blocker

- **URL:** https://github.com/damankarora/ios-spam-call-blocker · **sem LICENSE** (o próprio README
  diz "all rights are reserved by default") · push 2026-07-17 · Swift · 0 ★.
- **Arquitetura:** XcodeGen (`project.yml`), app SwiftUI + Call Directory Extension; faixas
  (código do país + prefixo + até 6 dígitos curinga = 1 000 000 números) em `UserDefaults` de App
  Group; o handler **ordena e deduplica** e registra em ordem estritamente crescente `Int64`
  (o README registra que fora de ordem o lote inteiro é descartado).
- **Privacidade:** zero rede. **Testes:** nenhum.
- **Reuso:** ❌ código; ✅ lição: faixas grandes + ordenação estrita + reload explícito.

## 9. Yet Another Call Blocker (GitLab) — base offline com delta diário

- **URL:** https://gitlab.com/xynngh/YetAnotherCallBlocker · F-Droid `dummydomain.yetanothercallblocker`.
- **Licença:** **AGPL-3.0-only** (API GitLab + fdroiddata) · última atividade 2026-09-30 · 146 ★.
- **Anti-feature F-Droid:** `NonFreeNet` — "Depends on a non-libre source for its data".
- **Arquitetura/dados:** DB offline baixado de outro repo GitLab
  ([YetAnotherCallBlocker_data](https://gitlab.com/xynngh/YetAnotherCallBlocker_data));
  README: base vem de "some other proprietary app" (número, categoria, contagem de avaliações
  negativas/positivas/neutras). **Atualizações incrementais/delta diárias.**
- **Recursos:** bloqueio por rating negativo, blacklist com curinga, notificação com resumo durante
  a chamada, reviews online, importação de backup do NoPhoneSpam, "advanced blocking mode" Android 7+.
- **Privacidade:** README documenta vazamentos possíveis (IP + versão da base + país; IP + número
  nas reviews online) e pede confirmação ao consultar número da agenda.
- **Testes:** não verificado.
- **Lição:** **dado de origem proprietária = risco jurídico e anti-feature**; delta diário é o
  padrão certo de atualização.

## 10–11. Saracroche (Android e iOS) — referência francesa, a mais próxima do nosso escopo

- **URLs:** https://codeberg.org/cbouvat/saracroche-android · https://codeberg.org/cbouvat/saracroche-ios
  (espelhos GitHub `cbouvat/saracroche-*` **arquivados**, README aponta para Codeberg).
- **Licença:** **GPL-3.0** (arquivo LICENSE no Codeberg; F-Droid: GPL-3.0-or-later). Dados de
  faixas: **CC BY-NC-SA 4.0** (segundo o README do CallShield, que os importa — não verificado na
  fonte Saracroche).
- **Atividade:** Android 2026-10-01 (Kotlin, 113 ★ Codeberg); iOS 2026-09-17 (Swift, 37 ★).
- **Arquitetura iOS:** 4 targets — app SwiftUI (CoreData, entidade única `Pattern`), **Call
  Directory Extension**, **Unwanted Communication Reporting** extension (`unwanted/`), **Message
  Filter Extension** (`filter/`); padrões curinga `33899######`; atualização em background a cada 6 h.
- **Arquitetura Android:** Compose, Call Screening API, Room, WorkManager, DataStore, Gson.
- **Anti-feature F-Droid (Android):** `NonFreeNet` — "Depends on saracroche.org for numbers reporting".
- **Modelo de negócio:** edição Enterprise (MDM, dashboard) — app gratuito + B2B.
- **Testes:** iOS tem `saracrocheTests` e `make test`; Android não verificado.
- **Lição:** bloquear **faixas regulatórias** (no Brasil: 0303) cobre muito spam sem base
  comunitária; extensão de **reporting** nativa do iOS é canal de denúncia barato.

## 12. adamff-dev/spam-call-blocker-app

- **URL:** https://github.com/adamff-dev/spam-call-blocker-app · **GPL-3.0** · push 2026-09-12 · Kotlin · 211 ★.
- **Recursos:** bloquear oculto/fora da agenda/internacional; **consulta em tempo real a APIs de
  terceiros** (UnknownPhone, Tellows, TrueCaller); níveis STIR/SHAKEN; auto-mute; auto-update.
- **Privacidade:** envia o número de cada chamada a serviços proprietários — **anti-padrão** para nós.
- **Testes:** nenhum. **i18n:** `values-pt` (não pt-BR). **Reuso:** ❌.

## 13. Divested-Mobile/Carrion — STIR/SHAKEN puro

- **URL:** https://github.com/Divested-Mobile/Carrion (**arquivado**; F-Droid aponta
  `gitlab.com/divested-mobile/carrion`) · F-Droid `us.spotco.carrion`, AGPL-3.0-or-later · Java · 48 ★.
- **Técnica:** `ScreeningService.java` usa `Call.Details.getCallerNumberVerificationStatus()`:
  `VERIFICATION_STATUS_FAILED` → recusa; `PASSED` → libera; não assinado → notifica (opcional
  silenciar). DB opcional `complaint_numbers.txt.gz` em `HashSet` (FTC DNC) → **silencia, nunca recusa**.
  Três níveis de base (archive ≥ 10 reports/360 arquivos; high ≥ 2/90; full).
- **Privacidade:** não pede contatos (o sistema não repassa contatos ao screening sem
  `READ_CONTACTS`); nada é enviado. **i18n:** `values-pt-rBR`. **Testes:** nenhum.
- **Lição:** no Brasil, sinal STIR/SHAKEN depende de operadora/Anatel ("Origem Verificada") — tratar
  como sinal opcional (API 30+). Ideia "base comunitária só silencia" casa com nosso fail-safe.

## 14. afterxleep/Bouncer — filtro SMS iOS (ILMessageFilterExtension)

- **URL:** https://github.com/afterxleep/Bouncer · **MIT** · push 2026-10-07 · Swift · 408 ★ · App Store.
- **Arquitetura:** SwiftUI, arquitetura Redux-like + Combine; `Models/SMSFilter/MessageFilterEngine.swift`
  devolve `ILMessageFilterQueryResponse` com `action` e **`subAction`** (iOS 16+: Junk,
  Promotion, Transaction e subcategorias); `RegexValidator.swift`; `FilterStoreFileMigrator`
  (migração de formato de regras).
- **Recursos:** listas de palavras, **regex PCRE**, import/export de regras, en/es.
- **Privacidade:** decisão 100 % on-device, **mas** o README declara que cada regra criada/alterada
  (frase, onde procurar, ação) + região + hora é enviada a servidor do desenvolvedor (analytics
  "SupaDB"). Anti-padrão para nós.
- **Testes:** 17 arquivos de teste.
- **Reutilizável (MIT):** mapeamento de categorias/subcategorias para `ILMessageFilterQueryResponse`,
  validador de regex, migrador de formato.

## 15. ffimnsr/spam-sniper — Call Directory com listas assinadas

- **URL:** https://github.com/ffimnsr/spam-sniper · LICENSE **MIT** (GitHub: NOASSERTION) · push 2026-06-18 · Swift · 3 ★.
- **Arquitetura:** app + `SpamSniperCallBlocker` (Call Directory) + `Shared/` (SQLite compartilhado,
  `BlocklistSyncService`, `BlocklistSignatureVerifier`); catálogo de repositórios de listas,
  seleção por repositório; merge com bloqueios pessoais; contatos excluídos do import.
- **Segurança:** metadados e listas verificados por assinatura **OpenPGP via ObjectivePGP**.
- ⚠️ **ObjectivePGP** ([krzyzanowskim/ObjectivePGP](https://github.com/krzyzanowskim/ObjectivePGP),
  `LICENSE.txt`): licença dupla — **"Free for non-commercial use"** + licença comercial.
  Incompatível com nossa política (não-OSI). Usar Ed25519 via CryptoKit/libsodium no lugar.
- **Testes:** 6 arquivos. **Reuso:** ideia de catálogo multi-fonte; código próprio MIT ok.

## 16–17. apple/pir-service-example + apple/swift-homomorphic-encryption — Live Caller ID Lookup

- **URLs:** https://github.com/apple/pir-service-example (Apache-2.0, push 2026-10-01, 220 ★) ·
  https://github.com/apple/swift-homomorphic-encryption (Apache-2.0, push 2026-10-07, 661 ★).
- **O que é:** backend de exemplo para **Live Caller ID Lookup** (iOS) e **NEURLFilter**: o sistema
  consulta o servidor via **PIR** (Private Information Retrieval com criptografia homomórfica) — o
  servidor **não sabe qual número foi consultado**; autenticação anônima por **Privacy Pass**
  (`Sources/PrivacyPass`). README: "just an example service and should not be run in production".
- **Componentes:** `PIRService` (Hummingbird), `ConstructDatabase`, `PrivacyPass`;
  executáveis `PIRProcessDatabase`, `PIRShardDatabase` (no swift-HE); **reload sem restart via
  SIGHUP** mantendo versões antigas de parâmetros PIR para clientes desatualizados.
- **Requisitos Apple (doc oficial):** a extensão exige **relays da Apple** e **validação de endpoint
  pela Apple**; `Info.plist` precisa do endpoint de serviço e do issuer de Private Access Token
  ([doc](https://developer.apple.com/documentation/identitylookup/getting-up-to-date-calling-and-blocking-information-for-your-app)).
- **Testes:** 13 arquivos + CI. **Reuso:** ✅ Apache-2.0 (LICENSE + NOTICE). Servidor Swift ≠
  nosso stack Node/Postgres → rodar como **serviço separado** alimentado pelo mesmo dataset assinado.

## 18. CallerAPI/Falcon — motor de risco SIP (lado operadora)

- **URL:** https://github.com/CallerAPI/Falcon · Apache-2.0 · push 2026-10-07 · Go · 5 ★.
- **Técnicas:** verificação STIR/SHAKEN completa (ES256, cadeia até CAs do STI-PA, CRL, frescor,
  claims orig/dest, SPC do assinante); listas allow/deny com expiração; score local + ação
  `allow|flag|challenge|reject` **com razões**; `/metrics` Prometheus; SQLite único.
- **Privacidade:** **telemetria ligada por padrão** (número chamador enviado), número chamado
  substituído por **HMAC com segredo local** (`to_hmac`) para contar alcance de campanha sem
  identificar o assinante; cada instalação assina telemetria com **Ed25519** e o servidor vincula
  install-id à chave no primeiro contato. Telemetria opt-out é anti-padrão para nós; o truque do
  HMAC local e o binding de chave por instalação são reaproveitáveis como ideia.
- **Testes:** 52 arquivos `_test.go`.

## 19–20. signalwire/libstirshaken (MIT) e asipto/secsipidx (BSD-3-Clause-Clear)

- **libstirshaken:** C, RFC 8224/8588, PASSporT, STI-SP AS/VS, elementos STI-CA/STI-PA; push 2024-08-22.
- **secsipidx:** Go + C API, CLI e servidor HTTP para gerar/verificar header `Identity`, cache de
  certificados; push 2026-04-18. BSD-3-Clause-**Clear** não concede patentes.
- **Relevância:** só para um futuro lado servidor/operadora. No app, o Android já entrega o
  veredito (`getCallerNumberVerificationStatus`, API 30+); iOS não expõe esse sinal a terceiros
  (não verificado documentação pública que o exponha).

## 21. FossifyOrg/Phone

- **URL:** https://github.com/FossifyOrg/Phone · GPL-3.0 · push 2026-10-03 · Kotlin · 1352 ★.
- **Técnica:** discador completo (papel de app de telefone padrão) com
  `services/SimpleCallScreeningService.kt`; gestão de bloqueados em
  [FossifyOrg/Commons](https://github.com/FossifyOrg/Commons) (GPL-3.0: `ManageBlockedNumbersActivity`,
  import/export de bloqueados). **Reuso:** ❌ — ideia de import/export interoperável.

## 22. google/libphonenumber

- **URL:** https://github.com/google/libphonenumber · Apache-2.0 · push 2026-10-07 · 18 300 ★.
- Parsing/validação/formatação E.164, tipo de linha, geocoder e carrier (usado por SpamBlocker e
  calls-blocker). **Uso:** dependência permitida (servidor e Android). Nossas regras BR
  (DDD, nono dígito, 0303, 0800) continuam em `data/rules/brazil-numbering.json` + vetores de teste;
  libphonenumber como verificação cruzada, não fonte única.

## 23. Phishing.Database

- **URL:** https://github.com/Phishing-Database/Phishing.Database (antes `mitchellkrogza/…`) · MIT ·
  push 2026-10-02 · 1624 ★. Listas de domínios/links de phishing (≈ 497 mil domínios no README de
  2026-10-02), fornecedor do VirusTotal. **Uso possível:** fonte de domínios para o motor SMS
  (verificar no momento do import a licença dos arquivos de dados e falsos positivos de domínios BR).

## 24. emxsys/callattendant

- **URL:** https://github.com/emxsys/callattendant · MIT · push 2023-02-01 (inativo) · Python · 126 ★.
- Atendente automático para linha fixa com Raspberry Pi + modem: listas allow/block, correio de voz,
  triagem antes do primeiro toque. **Relevância:** baixa (fixo); ideia de "atendente que pede
  confirmação humana" para robocall.

---

## 25. Top técnicas para o AntiSpam BR (com origem e status de licença)

| Técnica | Origem | Licença | Onde aplicamos |
|---|---|---|---|
| Manifest assinado + shards por hash/conteúdo, download só do que mudou, 2 chaves (1 offline) | CallShield | MIT | ADR 0003 (já Ed25519 + shards por DDD) |
| `IChecker` com prioridade estável + detector de conflito allow×block | SpamBlocker, CallShield | MIT | ADR 0005 pipeline |
| Denúncia "não é spam" nunca remove sozinha → fila de revisão | CallShield | MIT (ideia) | ADR 0006 §5 + fluxo LEGITIMATE |
| IDs de denunciante = HMAC diário de /48 e /64; corroboração limitada por /48 | CallShield | MIT (ideia) | ADR 0006 §8 |
| Base comunitária só **silencia**, nunca recusa; STIR falhou → recusa | Carrion | AGPL (ideia) | ADR 0005 fail-safe |
| Maior prefixo comum para detectar campanha | stranger-call-blocker | Apache-2.0 | detecção de surto por faixa |
| Complement Naive Bayes on-device para SMS | SpamBlocker | MIT | M4 motor SMS (opcional) |
| Corpus SMS adversarial (homoglifo, zero-width, fullwidth) com métricas por tipo | CallShield | MIT/CC0 | `data/sms-corpus/` |
| `source-manifest` com licença/atribuição/frescor por fonte | CallShield | MIT (ideia) | `docs/BRAZIL_DATA_SOURCES.md` |
| Flavor sem INTERNET + APK reprodutível + hash do certificado publicado | SpamBlocker | MIT (ideia) | build F-Droid |
| PIR + Privacy Pass para consulta online sem revelar o número | apple/pir-service-example | Apache-2.0 | iOS Live Caller ID (M9+) |
| `subAction` iOS 16+ (Junk/Promotion/Transaction) | Bouncer | MIT | `apps/ios` Message Filter |
| Faixas regulatórias (0303 BR) opt-in | CallShield, Saracroche | MIT/GPL (ideia) | regra padrão BR |
| Extensão de reporting nativa iOS | Saracroche iOS | GPL (ideia) | canal de denúncia iOS |

## 26. Anti-padrões observados (não repetir)

- Dados de origem proprietária (YACB → `NonFreeNet`) ou NC (Saracroche/CallShield parcial).
- Telemetria opt-out (Falcon) ou envio de regras do usuário (Bouncer produção).
- Consulta do número de cada chamada a Truecaller/Tellows (adamff-dev).
- Denúncia vinculada a conta GitHub pública (OpenCallShield) — identidade exposta.
- JSON único sem assinatura (OpenCallShield) · auto-instalador de APK (stranger-call-blocker).
- `READ_CALL_LOG` para screening (CallScreener) — desnecessário e restrito pela Play.
- Dependência de crypto com licença não-comercial (ObjectivePGP em spam-sniper).
