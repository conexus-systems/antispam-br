# FEATURE MATRIX — AntiSpam BR × projetos open-source

> **Data de verificação: 2026-10-07.** Fonte de cada célula: README e arquivos-fonte citados em
> [`REPOSITORIES.md`](REPOSITORIES.md). Projetos de biblioteca/infra pura (libstirshaken, secsipidx,
> swift-homomorphic-encryption, libphonenumber, Phishing.Database, callattendant) ficam fora das
> tabelas de apps e aparecem na §4.
>
> Legenda: ✅ presente · ⚠️ parcial/limitado (ver nota) · ❌ ausente · — não se aplica à plataforma ·
> **?** não verificado (não encontrado no README nem nos arquivos lidos).

## 1. Apps Android

| Projeto | CallScreening | SMS filter | Regex | Contatos allow | STIR/SHAKEN | DB comunitária | Offline | Datasets assinados | Score / explicação | Anti-poisoning | i18n / BR | Testes | Licença |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SpamBlocker | ✅ | ⚠️¹ | ✅ | ✅ | ✅ | ⚠️² | ✅ | ? | ⚠️³ | — | ✅ pt-BR (IA) · sem regras BR | ⚠️ 5 instrum. | MIT |
| CallShield | ✅ | ⚠️¹ | ✅ | ✅ | ✅ | ✅ Worker + merge manual | ✅ | ✅ ECDSA P-256 | ✅ regra decisiva + % | ✅⁴ | ⚠️ en/zh · prefixo 0303 opt-in | ✅ 1831 JVM | MIT (dados mistos) |
| OpenCallShield | ✅ | ❌ | ❌ prefixo | ✅ | ❌ | ⚠️ Issues GitHub + aprovação | ✅ | ❌ | ⚠️ texto do motivo | ❌ | es · sem BR | ❌ | MIT |
| calls-blocker (ryosoftware) | ✅ | ❌ | ❌ exato/prefixo | ✅ + grupos | ? | ❌ | ✅ | — | ⚠️ "Test Screening" | — | ? | ❌ | CC BY-NC-SA 4.0 |
| CallScreener (keyvisions) | ✅ | ❌ | ✅ | ✅ | ? | ❌ | ✅ sem INTERNET | — | ⚠️ regra que casou | — | ? | ❌ | GPL-3.0 |
| stranger-call-blocker | ✅ | ⚠️¹ | ❌ palavras-chave | ✅ | ? | ❌ | ✅ | — | ⚠️ rótulo | — | ? | ⚠️ 5 arquivos | MIT + Apache-2.0 |
| Yet Another Call Blocker | ⚠️⁵ | ❌ | ⚠️ curinga | ✅ | ? | ⚠️ base proprietária | ✅ + delta diário | ? | ⚠️ contagem +/−/neutro | ? | ? | ? | AGPL-3.0 |
| Saracroche Android | ✅ | ⚠️⁶ | ⚠️ padrões `#` | ? | ? | ⚠️ saracroche.org (NonFreeNet) | ✅ | ? | ? | ? | fr | ? | GPL-3.0 |
| spam-call-blocker-app (adamff) | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ APIs de terceiros | ⚠️ depende de API | — | ❌ | — | pt (não BR) | ❌ | GPL-3.0 |
| Carrion | ✅ | ❌ | ❌ | ✅ (sistema) | ✅ núcleo | ⚠️ FTC DNC | ✅ | ❌ | ⚠️ notificação de status | — | ✅ pt-BR | ❌ | AGPL-3.0 |
| Fossify Phone | ✅ (discador) | — | ? | ? | ? | ❌ | ✅ | — | ❌ | — | ? | ? | GPL-3.0 |

¹ Android não permite a apps não-padrão apagar/abortar SMS (`SMS_RECEIVED` não é abortável desde
4.4 — documentado no README do CallShield). Esses apps leem `RECEIVE_SMS`/notificações e **avisam**,
não bloqueiam a entrega.
² SpamBlocker integra bases baixáveis (ex. FTC DNC) e consulta APIs externas (ex. PhoneBlock); não
mantém base própria.
³ Histórico e detector de conflito de prioridade; sem score numérico de reputação.
⁴ "Not spam" nunca remove sozinho, corroboração (≥ 3 denunciantes, ≥ 2 h), HMAC diário de /48 e /64,
rate limit por cliente//48/global.
⁵ "Advanced call blocking mode" (Android 7+); mecanismo exato não verificado no código.
⁶ README diz "Blocks unwanted SMS"; mecanismo não verificado.

## 2. Apps iOS e serviços

| Projeto | Call Directory | Live Caller ID | SMS filter (ILMessageFilter) | Regex | Contatos allow | DB comunitária | Offline | Datasets assinados | Score / explicação | Testes | Licença |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Saracroche iOS | ✅ padrões curinga | ❌ | ✅ + extensão de reporting | ⚠️ padrões | ? | ⚠️ saracroche.org | ✅ | ? | ? | ✅ `saracrocheTests` | GPL-3.0 |
| OpenCallBlock | ✅ faixa NPA-NXX | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | — | ❌ | ⚠️ mínimo | MPL-2.0 |
| ios-spam-call-blocker | ✅ faixas ≤ 10⁶ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | — | ❌ | ❌ | sem licença |
| spam-sniper | ✅ | ❌ | ❌ | ❌ | ✅ (no import) | ⚠️ catálogo de listas | ✅ | ✅ OpenPGP⁷ | ❌ | ⚠️ 6 arquivos | MIT |
| Bouncer | — | — | ✅ + `subAction` iOS 16+ | ✅ PCRE | ? | ❌ | ✅ | — | ⚠️ regra que casou | ✅ 17 arquivos | MIT |
| pir-service-example (Apple) | — | ✅ servidor PIR + Privacy Pass | — | — | — | — | — | — | — | ✅ | Apache-2.0 |
| Falcon (lado SIP) | — | — | — | — | — | ⚠️ feed pago opcional | ✅ | ⚠️ telemetria assinada Ed25519 | ✅ ação + razões | ✅ 52 arquivos | Apache-2.0 |

⁷ via ObjectivePGP — licença não-comercial (ver LEGAL §2).

## 3. AntiSpam BR (planejado) — mesma grade

| Recurso | AntiSpam BR | Referência de decisão |
|---|---|---|
| CallScreening | ✅ Android 10+ (`ROLE_CALL_SCREENING`), resposta < 5 s, fail-safe | [ANDROID_LIMITATIONS](ANDROID_LIMITATIONS.md), ADR 0005 |
| Call Directory | ✅ blocking + identification a partir do shard (ordem `u64` = ordem exigida pelo CallKit) | ADR 0003 |
| Live Caller ID | ⚠️ planejado M9+: servidor PIR separado (base Apache-2.0 da Apple); exige validação de endpoint pela Apple | REPOSITORIES §16 |
| SMS filter | ✅ iOS `ILMessageFilterExtension` on-device · ⚠️ Android: análise por compartilhamento/`PROCESS_TEXT`, **sem permissão de SMS** no MVP | ADR 0008 |
| Regex / regras | ✅ regras como dado versionado (`data/rules/*.json` + schema) | ADR 0002 |
| Contatos allow | ✅ (contatos nunca bloqueados; `READ_CONTACTS` opcional) | ADR 0005 |
| STIR/SHAKEN | ✅ sinal opcional (API 30+); nunca único critério | ADR 0005 |
| DB comunitária | ✅ API própria Postgres, denúncia anônima por token rotativo | ADR 0004, 0007 |
| Offline | ✅ decisão local; rede só para baixar dataset | ADR 0001 |
| Datasets assinados | ✅ manifest Ed25519 destacado, `sha256` por shard, delta com tombstone, **anti-rollback** (`version` monotônica) e **anti-freeze** (`expires_at`), 2 chaves | ADR 0003, `specs/DATASET_FORMAT.md` |
| Score / explicabilidade | ✅ 0–100 determinístico com breakdown por fator (API + portal) | ADR 0006 |
| Anti-poisoning | ✅ peso por denunciante, Σw ≥ 2 para mover score, decaimento 30 d, quarentena de surto, outlier p99, rate limit /24 e /48, PoW, nonce anti-replay | ADR 0006 |
| i18n / BR | ✅ pt-BR primeiro; numeração BR (DDD, 9º dígito, 0303, 0800, emergências `never_block`) | `docs/research/BRAZIL.md` |
| Testes | ✅ vetores de teste compartilhados (Kotlin, Swift, TS) | ADR 0002 |
| Licença | MIT (código) · ODbL-1.0 (dataset comunitário, recomendado) | [LEGAL](../LEGAL_AND_LICENSE_REVIEW.md) |

## 4. Bibliotecas e feeds (não são apps)

| Componente | Papel | Licença | Uso pelo AntiSpam BR |
|---|---|---|---|
| apple/swift-homomorphic-encryption | PIR/HE para Live Caller ID | Apache-2.0 | servidor PIR (M9+) |
| google/libphonenumber | parsing/validação E.164 | Apache-2.0 | verificação cruzada do normalizador |
| signalwire/libstirshaken | STIR/SHAKEN em C | MIT | só se houver lado operadora |
| asipto/secsipidx | STIR/SHAKEN em Go | BSD-3-Clause-Clear | idem |
| Phishing.Database | domínios de phishing | MIT | fonte candidata do motor SMS (curadoria BR) |
| emxsys/callattendant | triagem em linha fixa | MIT | só ideia |

## 5. Lacunas que nenhum projeto cobre (o que o AntiSpam BR entrega)

1. **Numeração brasileira como dado testável.** Nenhum projeto modela DDD, nono dígito, 0303
   (telemarketing, Anatel), 0800/0300/4004 e serviços de utilidade pública/emergência como
   `never_block`. CallShield só tem 0303 como prefixo opt-in. Nós: `brazil-numbering.json` +
   vetores rodando em Kotlin, Swift e TS.
2. **Golpes brasileiros no motor SMS.** Nenhum corpus cobre PIX, boleto, falsa central de banco,
   falso Correios/entrega, "mãe troquei de número" em pt-BR. CallShield cobre "Hi mum" em várias
   línguas, sem pt-BR verificado.
3. **Contestação pelo titular com efeito garantido (LEGITIMATE) e base em LGPD arts. 18 e 20.**
   CallShield tem fila de revisão manual; nenhum projeto oferece fluxo formal com prazo, efeito no
   próximo delta e revisão humana de decisão automatizada.
4. **Peso por reputação do denunciante.** CallShield exige corroboração e limita por rede, mas
   não pondera o histórico do denunciante; os demais contam reports brutos (OpenCallShield) ou não
   têm comunidade.
5. **Um único dataset assinado para três consumidores:** Android CallScreening, iOS Call Directory
   e servidor PIR do Live Caller ID. Ninguém cobre os três; Saracroche cobre as duas plataformas sem
   assinatura verificada; spam-sniper assina só no iOS.
6. **Anti-rollback e anti-freeze de dataset** (`version` monotônica + `expires_at`): não encontrado
   nos projetos lidos (CallShield assina e verifica hash, mas proteção explícita contra rollback não
   foi verificada).
7. **Licença de dados explícita e compatível** para a base comunitária (ODbL). Os demais publicam
   dados sob a licença do código (MIT/GPL) ou herdam termos NC de terceiros (CallShield ← Saracroche),
   ou dependem de base proprietária (YACB).
8. **Política de publicação conservadora**: Σw ≥ 3, idade ≥ 48 h, sem contestação pendente, sem
   quarentena, e **organização verificada limitada a WARN** (centrais compartilhadas de bancos).
9. **Consulta online privada também no Android**: k-anonimato por prefixo de hash (iOS usa PIR).
   Os outros apps Android ou não consultam, ou mandam o número em claro (adamff → Truecaller/Tellows;
   SpamBlocker Instant Query; CallShield SkipCalls opcional).
10. **Explicação por fator do score comunitário** (peso, decaimento, categoria, contestações) visível
    ao usuário e ao titular no portal. Falcon explica razões no lado SIP; CallShield mostra a regra
    decisiva no device; ninguém explica o score comunitário.
