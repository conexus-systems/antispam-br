# LEGAL AND LICENSE REVIEW — AntiSpam BR

> **Data de verificação: 2026-10-07.** Licenças verificadas via GitHub/GitLab/Codeberg API e arquivos
> LICENSE (detalhes em [`research/REPOSITORIES.md`](research/REPOSITORIES.md)). Trechos de política
> foram lidos nas páginas oficiais citadas, nesta data. Isto é análise técnica de conformidade,
> **não parecer jurídico**: antes do beta público, validar §5 (LGPD) e §4 (licença de dados) com
> advogado(a).

## 0. Decisões

1. **Código: MIT** em todo o repositório (apps, extensões, API, portal, pacotes).
2. **Nunca copiar código GPL/AGPL/LGPL, CC-NC, ou sem licença.** Projetos copyleft = só leitura
   para ideias; implementação própria do zero (§2).
3. **Dependências em binários distribuídos:** allowlist MIT, BSD-2/3, Apache-2.0, ISC, MPL-2.0
   (por arquivo), 0BSD, CC0, Unlicense, Zlib; denylist GPL, AGPL, LGPL estática, SSPL, BUSL,
   CC-NC/ND, "free for non-commercial use" (§3).
4. **Dataset comunitário: ODbL-1.0** (base) + **DbCL-1.0** (conteúdo individual) (§4).
5. **LGPD:** base legal **legítimo interesse (art. 7º IX + art. 10)** com teste de balanceamento
   registrado; art. 11 II g **não se aplica** (§5).
6. **Android:** só `ROLE_CALL_SCREENING`; **nenhuma** permissão dos grupos SMS/Call Log no build
   da Play (§6). **iOS:** só bloquear números que passam na política de publicação (§7).
7. **F-Droid:** flavor sem Google Play Services/Firebase, endpoint configurável, build reprodutível (§8).

> Correção em relação à versão anterior deste documento: **aj3423/SpamBlocker é MIT**, não GPL-3.0
> (LICENSE e fdroiddata verificados). YACB é **AGPL-3.0-only**, não GPL-3.0.

## 1. Compatibilidade com MIT, por projeto pesquisado

| Projeto | Licença verificada | Copiar código para o AntiSpam BR? | Condição |
|---|---|---|---|
| aj3423/SpamBlocker | MIT | ✅ | manter copyright + texto MIT em `THIRD_PARTY_NOTICES` |
| SysAdminDoc/CallShield (código) | MIT | ✅ | idem |
| SysAdminDoc/CallShield (dados) | mistos: inclui CC BY-NC-SA 4.0 (Saracroche), listas GPL-2.0/GPL-3.0 recomendadas, CC BY 4.0 (corpus IMC 2025) | ❌ **não importar o dataset** | NC é incompatível com ODbL e com uso comercial de terceiros |
| jhonsu01/OpenCallShield | MIT | ✅ | atribuição |
| ryosoftware/calls-blocker | CC BY-NC-SA 4.0 | ❌ | NC + SA; não é licença de software OSI |
| keyvisions/CallScreener | GPL-3.0 | ❌ só ideias | — |
| khrlagst/stranger-call-blocker | MIT (app) + Apache-2.0 (`sb-engine-core`, `sb-engine-android`) | ✅ | Apache: LICENSE + NOTICE + marcar arquivos modificados |
| chrisballinger/OpenCallBlock | MPL-2.0 | ⚠️ por arquivo | arquivo MPL modificado continua MPL e com fonte disponível; preferir reescrever |
| damankarora/ios-spam-call-blocker | sem licença | ❌ | todos os direitos reservados |
| xynngh/YetAnotherCallBlocker (GitLab) | AGPL-3.0-only | ❌ só ideias | dados de origem proprietária — não usar |
| cbouvat/saracroche-android / -ios (Codeberg) | GPL-3.0 (F-Droid: GPL-3.0-or-later) | ❌ só ideias | dados de faixas CC BY-NC-SA (via README CallShield; não verificado na fonte) |
| adamff-dev/spam-call-blocker-app | GPL-3.0 | ❌ só ideias | — |
| Divested-Mobile/Carrion | AGPL-3.0 (F-Droid: AGPL-3.0-or-later) | ❌ só ideias | — |
| FossifyOrg/Phone, FossifyOrg/Commons | GPL-3.0 | ❌ só ideias | — |
| afterxleep/Bouncer | MIT | ✅ | atribuição |
| ffimnsr/spam-sniper | MIT (código próprio) | ✅ código próprio | ❌ **ObjectivePGP**: licença dupla "Free for non-commercial use" + comercial |
| apple/pir-service-example | Apache-2.0 | ✅ | LICENSE + NOTICE; README avisa "should not be run in production" |
| apple/swift-homomorphic-encryption | Apache-2.0 | ✅ | LICENSE + NOTICE |
| CallerAPI/Falcon | Apache-2.0 | ✅ | LICENSE + NOTICE |
| signalwire/libstirshaken | MIT | ✅ | atribuição |
| asipto/secsipidx | BSD-3-Clause-Clear | ✅ | atribuição; **não concede patentes** (cláusula "Clear") |
| google/libphonenumber | Apache-2.0 | ✅ dependência | NOTICE no app |
| Phishing.Database | MIT | ✅ dados | atribuição; revisar falsos positivos antes de publicar |
| emxsys/callattendant | MIT | ✅ | atribuição |
| Truecaller, Hiya, Whoscall, Should I Answer? | proprietária | ❌ | só conceitos não protegidos; nunca usar dados/APIs/scraping |

## 2. Política "nunca copiar código GPL/AGPL"

- **Leitura permitida**, cópia proibida: nenhum trecho, tradução linha a linha (ex.: Java→Kotlin)
  ou paráfrase estrutural de arquivo GPL/AGPL/LGPL/CC-NC/sem licença.
- **Implementação limpa:** quem estudou um arquivo copyleft não implementa o equivalente no mesmo
  dia a partir de memória visual; documenta o **conceito** (em pt-BR, sem código) numa issue/ADR, e a
  implementação parte dessa descrição.
- **Origem obrigatória no PR:** todo PR declara "código de terceiros: não / sim (repo, commit,
  arquivo, licença)". Código MIT/BSD/Apache/MPL entra com cabeçalho SPDX original preservado e
  linha em `THIRD_PARTY_NOTICES.md`.
- **Por que inclusive AGPL em ideias:** AGPL/GPL protegem expressão, não ideias; algoritmos
  descritos (ex.: "base comunitária só silencia", Carrion) são livres para reimplementar.
- **iOS:** além da incompatibilidade com MIT, distribuir GPL pela App Store é conflito
  amplamente discutido (termos adicionais da loja × GPL) — mais um motivo para zero GPL no iOS.
- **Revisão:** REVIEWER rejeita PR com código copiado; CI roda scanner de licenças (§3).

## 3. Política de licenças de dependências

| Classe | Licenças | App Android / iOS (binário distribuído) | API / portal (servidor) | Ferramentas de build/teste |
|---|---|---|---|---|
| Permissivas | MIT, BSD-2-Clause, BSD-3-Clause, BSD-3-Clause-Clear, ISC, 0BSD, Zlib, Unlicense, CC0-1.0 | ✅ | ✅ | ✅ |
| Permissiva c/ NOTICE | Apache-2.0 | ✅ incluir NOTICE na tela "Licenças" | ✅ | ✅ |
| Copyleft por arquivo | MPL-2.0, EPL-2.0 (revisar) | ✅ sem modificar o arquivo (ou publicar a modificação) | ✅ | ✅ |
| Copyleft fraco | LGPL-2.1/3.0 | ❌ estática; dinâmica só com revisão (inviável em iOS) | ⚠️ revisão | ✅ |
| Copyleft forte | GPL-2.0/3.0 | ❌ | ❌ (evitar mesmo no servidor por coerência MIT) | ✅ se não distribuído |
| Rede | AGPL-3.0, SSPL, BUSL/BSL | ❌ | ❌ | ⚠️ revisão |
| Conteúdo NC/ND | CC BY-NC*, CC BY-ND*, "non-commercial use" | ❌ | ❌ | ❌ |
| Proprietária / SDK fechado | Firebase, Play Services, Crashlytics, AdMob, SDKs de analytics | ❌ no flavor F-Droid; ❌ ads/analytics em qualquer flavor | — | — |

Execução no CI (falha o build se encontrar licença fora da allowlist):

- Node/TS: `license-checker --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD;CC0-1.0;Unlicense;MPL-2.0"`.
- Android: SBOM CycloneDX do `releaseRuntimeClasspath` + `gradle.lockfile` (padrão adotado pelo
  CallShield) e checagem da allowlist.
- iOS: lista de pacotes do `Package.resolved` com licença revisada manualmente (sem ferramenta
  padrão confiável — registrar em `THIRD_PARTY_NOTICES.md`).
- Exceção = ADR com justificativa.

## 4. Licença do dataset comunitário

### Recomendação: **ODbL-1.0** para a base + **DbCL-1.0** para o conteúdo

Referências: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) ·
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode).

| Critério | ODbL-1.0 | CC BY 4.0 |
|---|---|---|
| Feita para bases de dados (direito *sui generis*, extração) | ✅ | ✅ (4.0 cobre *sui generis*) |
| Impede "cercamento" (empresa pega a base, melhora e fecha) | ✅ share-alike em base derivada usada publicamente | ❌ derivada pode ser fechada |
| Simplicidade para reutilizadores | ⚠️ média | ✅ alta |
| Precedente comunitário | OpenStreetMap | Wikidata usa CC0; muitos governos usam CC BY |
| Combina com fontes CC BY 4.0 | ✅ com atribuição | ✅ |
| Combina com fontes CC BY-NC-SA | ❌ | ❌ |

**Justificativa.** O valor do AntiSpam BR é a base construída pela comunidade. O risco concreto do
setor é um app de caller ID proprietário absorver a base e devolver nada (modelo Truecaller/YACB). A
ODbL permite uso comercial, mas obriga quem publica **base derivada** a publicá-la sob ODbL —
protege a comunidade sem proibir uso. A CC BY 4.0 é uma alternativa legítima se a prioridade for
adoção máxima; fica como alternativa documentada, não como padrão.

**Implicações do share-alike (o que muda na prática):**

- O **código** (MIT) e a **base** (ODbL) são obras separadas: ler a base num app não torna o app
  ODbL.
- Distribuir a base dentro do APK/IPA é distribuir a própria base: o app deve trazer o aviso ODbL
  e indicar onde baixar a versão íntegra (já publicamos — manifest público).
- **Produced Work** (ex.: estatística, tela com veredito) exige só aviso de atribuição.
- Base derivada publicada por terceiros (ex.: base AntiSpam BR + lista própria) precisa ser ODbL.
- Não podemos importar fontes NC/SA incompatíveis (Saracroche, ryosoftware) nem listas GPL.
- Termos de uso das denúncias devem conceder ao projeto licença para publicar a contribuição
  agregada sob ODbL.
- **Licença de dados não substitui a LGPD:** quem reutiliza a base trata dado pessoal e vira
  controlador, com obrigações próprias. Publicamos isso no README do dataset como aviso, não como
  restrição adicional da licença.

Outros artefatos: regras (`data/rules/*.json`) e vetores de teste (`data/test-vectors/`) seguem
**MIT** (são parte do código); corpus SMS em `data/sms-corpus/` deve ser **CC0** se 100 % sintético,
ou herdar a licença da fonte (ex.: amostra IMC 2025 usada pelo CallShield é CC BY 4.0) com arquivo
`NOTICE` no diretório. Cada arquivo do dataset declara `license` no manifest.

## 5. LGPD (Lei 13.709/2018)

Texto: [planalto.gov.br — L13709](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) ·
Guia ANPD: [Hipóteses legais — Legítimo Interesse (fev/2024)](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_hipoteses_legais_tratamento_de_dados_pessoais_legitimo_interesse)
([notícia](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-orientativo-sobre-legitimo-interesse)).

### 5.1 Número de telefone é dado pessoal

Art. 5º I: dado pessoal é "informação relacionada a pessoa natural identificada ou identificável".
Um número de linha pessoal (inclusive números falsificados/spoofed ou reciclados) se relaciona a
uma pessoa natural → **dado pessoal**. Número de pessoa jurídica (central de empresa) não é, em
regra — mas não sabemos distinguir com certeza, então tratamos **todo número como dado pessoal**.

Art. 12: dado anonimizado só deixa de ser pessoal se a anonimização não puder ser revertida "com
esforços razoáveis". **SHA-256 de telefone é reversível por força bruta** (ADR 0004) → hash **não**
é anonimização; é pseudonimização.

### 5.2 Base legal

| Tratamento | Base | Fundamento |
|---|---|---|
| Decisão local no device (número recebido, contatos, regras) | não há tratamento pelo projeto (dado não sai do device) | — |
| Receber e armazenar denúncias (número denunciado + token rotativo) | **legítimo interesse** do controlador e de terceiros (usuários protegidos contra fraude) | art. 7º IX; art. 10 I/II |
| Publicar números no dataset | legítimo interesse, **após** política de publicação | art. 7º IX; art. 10 §1º (só o estritamente necessário) |
| Telemetria/diagnóstico opcional | consentimento (opt-in) | art. 7º I |
| Consulta online por prefixo de hash | legítimo interesse; servidor não registra prefixo com IP | art. 7º IX; art. 6º III |

**Art. 11 II g não é a nossa base.** Ele trata de **dado pessoal sensível** (art. 5º II: origem
racial, saúde, biometria etc.) e é restrito à "garantia da prevenção à fraude e à segurança do
titular, **nos processos de identificação e autenticação de cadastro em sistemas eletrônicos**".
O guia da ANPD diz que essa hipótese deve ser **interpretada restritivamente**. Número de telefone
não é dado sensível, e denúncia de spam não é autenticação de cadastro. A ANPD também observa que
o legítimo interesse **não se aplica a dados sensíveis** — portanto **não coletamos dado sensível**
(sem texto livre de SMS, sem voz, sem nome).

### 5.3 Teste de balanceamento (obrigatório, registrar antes do beta)

Modelo da ANPD em três fases:

1. **Finalidade:** prevenir golpes e spam por telefone/SMS; interesse legítimo, concreto e atual
   (art. 10 *caput*). Expectativa do titular: quem liga em massa não espera privacidade sobre o
   número de origem; quem é vítima de spoofing **espera** poder contestar.
2. **Necessidade:** só número E.164, categoria, contagem ponderada, datas; sem nome, endereço,
   comentários ou identidade do denunciante (art. 6º III; art. 10 §1º). Alternativa menos intrusiva
   avaliada: hash (rejeitado como "anonimização", ver 5.1); top-N por shard no iOS.
3. **Balanceamento e salvaguardas:** limiar de publicação (Σw ≥ 3, ≥ 48 h, sem contestação pendente,
   sem quarentena — `docs/specs/PUBLICATION_POLICY.md`); decaimento de 30 dias; contestação
   LEGITIMATE; linguagem "denunciado como", nunca "golpista"; `VERIFIED_ORG` limitado a WARN;
   bloqueio no device é **escolha do usuário**.

Art. 10 §2º (transparência) e §3º (ANPD pode pedir RIPD): publicar o teste e manter o RIPD
(art. 5º XVII; art. 38) pronto.

### 5.4 Direitos do titular = fluxo LEGITIMATE

- **Art. 18** (confirmação, acesso, correção, anonimização/bloqueio/eliminação, informação sobre
  compartilhamento): o portal permite consultar o status de um número e abrir contestação; prazo
  interno de 15 dias (PUBLICATION_POLICY).
- **Art. 20** — direito de pedir **revisão de decisões tomadas unicamente com base em tratamento
  automatizado** que afetem interesses do titular. O score comunitário é decisão automatizada que
  afeta o titular do número → contestação LEGITIMATE com **revisão por moderador humano** e
  explicação por fator (ADR 0006).
- Contestação aceita → tombstone no próximo delta; contestação pendente suspende publicação.
- Anti-abuso da própria contestação (atacante limpando o próprio número): contestação pesa, mas só
  zera com moderação (ADR 0006 §5).

### 5.5 Obrigações operacionais

- **Encarregado (art. 41)** e canal do titular publicados no portal.
- **Segurança (art. 46):** tokens rotativos, sem IMEI/GAID/IDFA/conta, TLS, chaves de assinatura
  offline, logs sem IP+número juntos.
- **Transferência internacional (art. 33):** se CDN/hosting estiver fora do Brasil, documentar a
  hipótese do art. 33 aplicável. Dataset publicado é público por design; a base de denúncias
  (com tokens) deve ficar em infraestrutura com hipótese de transferência documentada.
- Retenção: denúncias brutas com prazo definido; dataset só com o necessário.

## 6. Google Play — permissões

Fonte: [Use of SMS or Call Log permission groups](https://support.google.com/googleplay/android-developer/answer/10208820)
(lida em 2026-10-07) · [CallScreeningService](https://developer.android.com/reference/android/telecom/CallScreeningService).

- **Regra geral:** SMS/Call Log só para **handler padrão** (SMS, Phone ou Assistant), e o app "must
  be actively registered as the default … handler before prompting users"; deve parar de usar quando
  deixar de ser padrão.
- **Exceções** (temporárias, "subject to Google Play review and approval", e só se "there's currently
  no alternative method"): existe a exceção **"Caller ID, spam detection, and/or spam blocking"**,
  que lista `READ_SMS, RECEIVE_MMS, RECEIVE_SMS, RECEIVE_WAP_PUSH, SEND_SMS, READ_CALL_LOG,
  PROCESS_OUTGOING_CALLS`; e **"Anti-SMS phishing (smishing)"**, que exige "track record of
  significant protection … analyst reports, benchmark test results". Ambas exigem o
  **Permissions Declaration Form**.
- **Usos inválidos** listados incluem "SMS or phone notification enhancement and alerts (when the app
  is not the default handler or an eligible exception)" e "Any transfer that results in a sale of
  this data".
- **Mudança anunciada:** a partir de **27/01/2027**, verificação de conta por chamada deixa de ser
  uso aceito de `READ_CALL_LOG` (não nos afeta, mas mostra que a política está apertando).
- **CallScreeningService não precisa de Call Log:** o serviço é vinculado pelo papel
  `RoleManager.ROLE_CALL_SCREENING`; a doc diz que só chamadas **fora dos contatos** são passadas,
  "unless the CallScreeningService has been granted `READ_CONTACTS`". O Android 10 declara que o
  screening elimina a necessidade de `READ_CALL_LOG` (ver
  [`research/ANDROID_LIMITATIONS.md`](research/ANDROID_LIMITATIONS.md)).
- **Decisão:** build Play sem nenhuma permissão SMS/Call Log; SMS por compartilhamento (ADR 0008).
  `RECEIVE_SMS` opt-in só num flavor F-Droid, se um dia existir.
- Políticas complementares (User Data, Data safety, Prominent Disclosure) são citadas pela própria
  página como obrigatórias; conteúdo **não revisado neste documento** — revisar antes da submissão.

## 7. App Store — Review Guidelines

Fonte: [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
(lida em 2026-10-07).

- **2.5.12:** "Apps using CallKit or including an SMS Fraud Extension should **only block phone
  numbers that are confirmed spam**. Apps that include call-, SMS-, and MMS- blocking functionality or
  spam identification must **clearly identify these features in their marketing text and explain the
  criteria for their blocked and spam lists**. You may not use the data accessed via these tools for
  any purpose not directly related to operating or improving your app or extension (e.g. you may not
  use, share, or **sell** it for tracking purposes, creating user profiles, etc.)."
  → Call Directory **blocking** só com números que passam na política de publicação; números abaixo
  disso só como **identification** ("Suspeito: denunciado como …"). Critérios publicados na página
  da App Store e no portal.
- **5.1.1 (viii):** "Apps that compile personal information from any source that is not directly from
  the user or without the user's explicit consent, even public databases, are not permitted."
  → **Risco real** para base comunitária. Mitigação: o dado vem **diretamente do usuário** (denúncia
  da chamada que ele recebeu, ação explícita), não de scraping nem de bases públicas de terceiros;
  nenhuma fonte externa de números no build iOS sem revisão jurídica.
- **5.1.1 (i)/(ii)/(iii):** política de privacidade no app e na loja, consentimento para coleta
  (denúncia = ação explícita; telemetria opt-in), minimização.
- **5.1.2 (i)–(iv):** não compartilhar dados pessoais sem permissão; não reaproveitar finalidade;
  não montar base a partir dos Contatos (contatos só são lidos localmente para allowlist).
- **Live Caller ID Lookup** ([doc](https://developer.apple.com/documentation/identitylookup/getting-up-to-date-calling-and-blocking-information-for-your-app)):
  exige relays da Apple e **validação do endpoint pela Apple**; servidor PIR + Privacy Pass.
- `ILMessageFilterExtension` (iOS 11+) e `CXCallDirectoryProvider` (iOS 10+) confirmados na
  documentação Apple.

## 8. F-Droid

Fontes: [Inclusion Policy](https://f-droid.org/docs/Inclusion_Policy/) ·
[Anti-Features](https://f-droid.org/docs/Anti-Features/) ·
[Reproducible Builds](https://f-droid.org/docs/Reproducible_Builds/).

- **FLOSS obrigatório** (DFSG/FSF/OSI); dependências binárias só de compilação ou repositórios
  confiáveis (Maven Central, Google Maven, JitPack…), e ainda assim com licença livre.
- **Proibido:** Google Play Services, Firebase, Crashlytics, SDKs proprietários de ads/tracking →
  flavor `fdroid` sem eles (padrão `fdroid`/`googleplay` do SpamBlocker).
- **Toolchain 100 % FLOSS**; F-Droid compila da fonte; build reprodutível recomendado (SpamBlocker
  publica APK reprodutível e o hash do certificado).
- **Sem download de binário executável** (auto-update, add-ons) sem opt-in explícito → nada de
  auto-instalador de APK. **Datasets não são executáveis**, mas manter verificação de assinatura.
- **F-Droid não cadastra API keys** e as inclui no binário e na fonte se existirem → não depender de
  chave secreta no cliente.
- **Anti-features a evitar:**
  - `Tracking` — crash report/checagem de update sem opt-in (Sentry só opt-in no flavor F-Droid).
  - `NonFreeNet` — nossa API é MIT, então não se aplica, **desde que** não dependamos de serviço
    proprietário (YACB e Saracroche recebem essa marca).
  - `TetheredNet` — não se aplica se houver "a simple configuration option" para apontar para
    instância alternativa auto-hospedável → **URL da API e do dataset configuráveis** + espelho.
  - `NonFreeAssets` — ícones/sons sem NC/ND.
- Application ID próprio, de domínio do projeto.

## 9. Riscos residuais

| Risco | Prob. | Mitigação |
|---|---|---|
| Número legítimo publicado como spam (dano reputacional) | Média | política de publicação, decaimento, contestação com revisão humana (art. 20), linguagem "denunciado como" |
| Rejeição na App Store por 5.1.1(viii) | Média | dado vem do usuário; critérios publicados (2.5.12); revisão jurídica antes da submissão |
| Rejeição na Play por permissão restrita | Baixa (se seguirmos §6) | build Play sem SMS/Call Log |
| Contaminação de licença por PR | Baixa | declaração de origem + scanner no CI |
| Importar fonte com licença NC/SA | Média | `license` obrigatório por fonte no manifest; allowlist de licenças de dados (CC0, CC BY 4.0, ODbL, domínio público) |
| Uso da base para assédio | Baixa | sem nome/endereço; portal só agregados; rate limit |
| Reutilizador ignora LGPD | Média | aviso no README do dataset; não conseguimos impor — registrar no RIPD |
