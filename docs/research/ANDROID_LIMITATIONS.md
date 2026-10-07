# ANDROID LIMITATIONS — AntiSpam BR

> Pesquisa de plataforma (Android) com base em documentação **oficial**. Cada afirmação traz a URL
> da fonte. Onde a documentação é omissa, o item está marcado **"a verificar em device"**.
> Complemento: `docs/ANDROID_CAPABILITIES.md` (o que dá para fazer e as decisões de design).
> Última revisão das fontes: 2026-10-07.

## 1. Resumo dos limites duros

| Limite | Valor | Fonte |
|---|---|---|
| Prazo para `respondToCall()` em chamada recebida | **5 segundos** após `onScreenCall()`; depois disso o framework faz unbind e **ignora** a resposta | [CallScreeningService](https://developer.android.com/reference/android/telecom/CallScreeningService) |
| Telefone só começa a tocar após a resposta (ou timeout) | Todo atraso do app é atraso no toque | idem (seção *CallScreeningService Lifecycle*) |
| `ROLE_CALL_SCREENING` | API **29** (Android 10) | [RoleManager](https://developer.android.com/reference/android/app/role/RoleManager#ROLE_CALL_SCREENING) |
| `setSilenceCall`, `setRejectedAsMissed` | API **29** | [CallResponse.Builder](https://developer.android.com/reference/android/telecom/CallScreeningService.CallResponse.Builder) |
| `setCallComposerAttachmentsToShow` | API 31, e **só tem efeito** se o serviço for do mesmo pacote do discador do sistema | idem |
| `getCallerNumberVerificationStatus()` (STIR/SHAKEN) | API **30** | [Call.Details](https://developer.android.com/reference/android/telecom/Call.Details#getCallerNumberVerificationStatus()) |
| `getCallDirection()` | API 29 | idem |
| Intervalo mínimo de `PeriodicWorkRequest` | **15 minutos** | [WorkManager — define work](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work) |
| Target API exigido no Play | Novos apps/updates: **API 36** a partir de 31/08/2026 | [Target API requirements](https://developer.android.com/google/play/requirements/target-sdk) |
| `POST_NOTIFICATIONS` runtime | API 33+ | [Notification permission](https://developer.android.com/develop/ui/views/notifications/notification-permission) |

## 2. CallScreeningService — o que a plataforma restringe

### 2.1 Quem é chamado e quando

| Regra | Detalhe | Fonte |
|---|---|---|
| Um único app escolhido pelo usuário | "Telecom will bind to a single app chosen by the user which implements the `CallScreeningService` API" | [CallScreeningService](https://developer.android.com/reference/android/telecom/CallScreeningService) |
| Bind no recebimento **antes de tocar** e também em chamadas **efetuadas** | "when incoming calls are received (prior to ringing) and when outgoing calls are placed" | idem |
| `respondToCall` é ignorado em chamada efetuada | "Calls to this method are ignored unless `getCallDirection()` is `DIRECTION_INCOMING`" | [respondToCall](https://developer.android.com/reference/android/telecom/CallScreeningService#respondToCall(android.telecom.Call.Details,%20android.telecom.CallScreeningService.CallResponse)) |
| Só handles `tel:` | "Only calls where the handle scheme is `PhoneAccount.SCHEME_TEL` are passed" — VoIP com outros esquemas (`sip:`) não passa | [onScreenCall](https://developer.android.com/reference/android/telecom/CallScreeningService#onScreenCall(android.telecom.Call.Details)) |
| **Contatos não são passados** | "only calls which are not in the user's contacts are passed for screening, **unless** the CallScreeningService has been granted `READ_CONTACTS`" | idem |
| Número oculto/privado **não é passado** | Chamadas com `PRESENTATION_RESTRICTED`, `PRESENTATION_UNKNOWN`, `PRESENTATION_UNAVAILABLE` ou `PRESENTATION_PAYPHONE` "are not provided to the CallScreeningService" | idem |
| Chamada efetuada sem pós-discagem | "For outgoing calls, no post-dial digits are passed" | idem |
| API 24–28 | A classe existe desde a API 24, mas a abertura para apps de terceiros via papel veio no Android 10 ("Call screening and caller ID") — antes disso, na prática, só o discador padrão. **Comportamento exato em 24–28 a verificar em device.** | [Android 10 features](https://developer.android.com/about/versions/10/features) |

**Consequência:** o AntiSpam BR **não consegue** bloquear números ocultos (o tipo mais comum de golpe
"central do banco" com número restrito) via `CallScreeningService`. Isso fica com o discador / operadora.

### 2.2 Campos disponíveis em `Call.Details`

A documentação é explícita: só estes campos vêm preenchidos para o serviço de screening; **todo o resto vem
default/null** ([onScreenCall](https://developer.android.com/reference/android/telecom/CallScreeningService#onScreenCall(android.telecom.Call.Details))):

| Campo | API | Uso |
|---|---|---|
| `getHandle()` | 23 | Número (`tel:`) — chave da consulta local |
| `getCallDirection()` | 29 | Distinguir entrada/saída |
| `getCallerNumberVerificationStatus()` | 30 | `Connection.VERIFICATION_STATUS_PASSED` / `FAILED` / `NOT_VERIFIED` (STIR, ATIS-1000082) |
| `getCreationTimeMillis()` | 26 | Telemetria local de latência |
| `getConnectTimeMillis()` | 23 | — |

**Não disponíveis no screening:** `getAccountHandle()` (portanto **não dá para saber qual SIM** em dual SIM),
`getCallerDisplayName()`, `getExtras()`, `getContactDisplayName()`. Fonte: lista acima, mesma página.

### 2.3 Flags de `CallResponse.Builder` e restrições

| Método | API | Restrição documentada |
|---|---|---|
| `setDisallowCall` | 24 | — |
| `setRejectCall` | 24 | "should only be set to true if the call is disallowed" |
| `setSkipCallLog` | 24 | **"Only the carrier and system call screening apps can use this parameter; this parameter is ignored otherwise."** Chamadas bloqueadas sempre são logadas como `BLOCKED_TYPE` |
| `setSkipNotification` | 24 | Só faz sentido com disallow |
| `setSilenceCall` | 29 | Só faz sentido se **não** houve disallow; chamada ainda vai para o discador, sem toque |
| `setRejectedAsMissed` | 29 | `build()` lança `IllegalStateException` se `rejectedAsMissed=true` sem `disallow` e sem `reject` |
| `setCallComposerAttachmentsToShow` | 31 | Sem efeito se o serviço não for do pacote do discador do sistema |

Fonte: [CallResponse.Builder](https://developer.android.com/reference/android/telecom/CallScreeningService.CallResponse.Builder).

> Correção em relação à versão anterior deste documento: `setSilenceCall` é **API 29**, não 31.
> O código atual (`AntiSpamCallScreeningService.kt`) pode habilitar SILENCE a partir do Android 10.

Bloqueios via screening são registrados no call log com `BLOCK_REASON_CALL_SCREENING_SERVICE`
([respondToCall](https://developer.android.com/reference/android/telecom/CallScreeningService#respondToCall(android.telecom.Call.Details,%20android.telecom.CallScreeningService.CallResponse))) —
o usuário sempre vê o rastro no histórico do discador; não há bloqueio "invisível" para apps de terceiros.

### 2.4 Ciclo de vida, processo e latência

- O serviço é **bound** por chamada; se o processo do app estiver morto, o sistema cria o processo
  (cold start: `Application.onCreate` + DI + abertura do banco) **dentro dos mesmos 5 s**.
- `onScreenCall` deve ser tratado como chamado na **main thread** (padrão de callbacks de `Service`; a página
  não declara a thread explicitamente — a verificar em device). I/O vai para outra thread e `respondToCall`
  pode ser chamado de forma assíncrona, desde que dentro do prazo.
- A própria documentação recomenda "local database lookups" e alerta para "care should be taken to ensure the
  timeout is not repeatedly hit" ([CallScreeningService](https://developer.android.com/reference/android/telecom/CallScreeningService)).
- **Rede é inaceitável no caminho crítico:** DNS + TLS + RTT em 3G/4G brasileiro ou rede ruim não cabem com
  segurança em 5 s, e cada ms atrasa o toque. Decisão sai de dado local (Room/SQLite ou arquivo mmap).
- Cold start real (Application + Room/SQLite open + leitura do shard): **a verificar em device** (alvo: medir
  p50/p95 em low-end — ex.: moto g(6) play já usado em homologação).

### 2.5 Papel (RoleManager) e coexistência

| Ponto | Detalhe | Status |
|---|---|---|
| Solicitação | `RoleManager.createRequestRoleIntent(ROLE_CALL_SCREENING)` → `RESULT_OK` / `RESULT_CANCELED` | [RoleManager](https://developer.android.com/reference/android/app/role/RoleManager#createRequestRoleIntent(java.lang.String)) |
| Um titular por vez | Ao conceder para o AntiSpam BR, outro app de terceiros perde o papel | Documentado ("single app") |
| Google Phone "Caller ID & spam" | É recurso do **discador** (sistema), não do papel de terceiro; a nota de `setSkipCallLog` confirma que existem "carrier and system call screening apps" além do app do usuário. Ordem/precedência entre os três: **a verificar em device** | Parcial |
| Samsung Smart Call (Hiya) | Integrado ao discador Samsung; interação com nosso papel: **a verificar em device** (One UI 6/7) | Não documentado |
| Revogação | Usuário pode remover o papel em Configurações › Apps padrão a qualquer momento; app precisa checar `isRoleHeld` a cada abertura | Documentado |

## 3. OEMs, bateria e background

Fonte primária: [dontkillmyapp.com](https://dontkillmyapp.com/) (ranking atual: Huawei, Xiaomi, OnePlus,
Samsung no topo dos "piores").

| OEM | Problema relatado | Impacto no AntiSpam BR |
|---|---|---|
| Xiaomi / MIUI / HyperOS | Limitações não padrão, "Background autostart" por app (MIUI 14), sem API nem documentação ([xiaomi](https://dontkillmyapp.com/xiaomi)) | Bind do screening é iniciado pelo sistema (não é background start do app), mas **autostart negado pode impedir o bind — a verificar em device**. WorkManager atrasa |
| Samsung One UI | Matança agressiva desde Android 9; Samsung prometeu (07/2024) respeitar FGS de apps que targetam 14 desde One UI 6.0 ([samsung](https://dontkillmyapp.com/samsung)) | Updates de dataset atrasam; screening: a verificar |
| Huawei EMUI | PowerGenie/HwPFWService matam processos não whitelisted ([huawei](https://dontkillmyapp.com/huawei)) | Idem; sem GMS em aparelhos recentes |
| Todos | Doze / App Standby Buckets adiam jobs | Update de base é *best effort*, nunca garante horário |

**Regra:** a proteção nunca pode depender de o processo estar vivo. O dataset fica em disco e é lido no
cold start; WorkManager só serve para **atualizar** o dataset.

## 4. SMS — não existe API de filtro para terceiros

O Android **não tem** equivalente ao `ILMessageFilterExtension` do iOS. Opções e custos:

| Abordagem | Permissões | Política Play | Viabilidade |
|---|---|---|---|
| App SMS padrão (`ROLE_SMS`, API 29) | `READ_SMS`, `RECEIVE_SMS`, `SEND_SMS`, … | Permitido **somente** enquanto for o handler padrão ([SMS/Call Log policy](https://support.google.com/googleplay/android-developer/answer/10208820)) | Exige reimplementar app de mensagens completo (MMS, RCS não acessível) — fora do escopo |
| `SMS_RECEIVED` broadcast sem ser padrão | `RECEIVE_SMS` | Exceção **"Caller ID, spam detection, and/or spam blocking"** lista `READ_SMS, RECEIVE_MMS, RECEIVE_SMS, RECEIVE_WAP_PUSH, SEND_SMS, READ_CALL_LOG, PROCESS_OUTGOING_CALLS` — mas é **exceção temporária**, sujeita a revisão e "no alternative method"; exceção **"Anti-SMS phishing (smishing)"** exige "track record of significant protection … analyst reports, benchmark test results" | Alto risco de rejeição para projeto novo; formulário de declaração obrigatório |
| `NotificationListenerService` | Acesso a notificações (setting especial) | Não é SMS permission, mas cai em "Permissions and APIs that Access Sensitive Information"; **Android 15 redige OTPs** para listeners não confiáveis ([Android 15 behavior changes](https://developer.android.com/about/versions/15/behavior-changes-all)); em sideload, Android 13+ aplica **Restricted settings** ([Google Help](https://support.google.com/android/answer/12623953)); não roda em low-RAM ≤ Android Q nem em work profile ([NLS](https://developer.android.com/reference/android/service/notification/NotificationListenerService)) | Possível, mas invasivo (lê **todas** as notificações) — conflita com privacy-first |
| Compartilhamento pelo usuário (`ACTION_SEND`, `ACTION_PROCESS_TEXT`) | Nenhuma | Sem restrição | **MVP recomendado** — análise sob demanda, 100% local |

Usos explicitamente **inválidos** na política (mesma página): "SMS or phone notification enhancement and
alerts (when the app is not the default handler or an eligible exception)", "Research", "Any transfer that
results in a sale of this data".

## 5. Permissões

| Permissão | Precisa? | Motivo / fonte |
|---|---|---|
| `BIND_SCREENING_SERVICE` | Sim (no `<service>`) | Protege o serviço; [CallScreeningService](https://developer.android.com/reference/android/telecom/CallScreeningService) |
| `READ_CONTACTS` | **Opcional** | Sem ela, contatos **nem chegam** ao serviço (proteção natural contra falso positivo). Com ela, chegam e o app precisa tratá-los. Só pedir se houver feature que exija (ex.: allowlist por contato com regras) |
| `READ_PHONE_STATE` | Não para screening | Não exigida pela API; remover se não houver outro uso |
| `READ_CALL_LOG` | **Evitar** | Restrita pela política SMS/Call Log; o Android 10 diz que screening "eliminates the requirement to obtain READ_CALL_LOG" ([Android 10 features](https://developer.android.com/about/versions/10/features)) |
| `POST_NOTIFICATIONS` | Sim (33+) | Avisos de bloqueio/silêncio |
| `FOREGROUND_SERVICE*` | Não | Screening é bound service; nada roda contínuo |
| `INTERNET` | Sim | Apenas para baixar snapshots/deltas fora da chamada |

## 6. Mudanças de versão relevantes (14 / 15 / 16)

| Versão | Mudança | Impacto |
|---|---|---|
| Android 13 | `POST_NOTIFICATIONS` runtime; Restricted settings para sideload | Onboarding de notificação; build F-Droid com NLS sofre fricção |
| Android 14 | Bloqueio de instalação de apps com target muito baixo ([14 behavior changes](https://developer.android.com/about/versions/14/behavior-changes-all)) | Irrelevante (target 36) |
| Android 15 | OTP redaction para `NotificationListenerService` não confiável | Inviabiliza parte da abordagem NLS para SMS de golpe com código |
| Android 16 | Nenhuma mudança em `CallScreeningService`/`RoleManager` encontrada nas páginas de behavior changes ([16 all](https://developer.android.com/about/versions/16/behavior-changes-all), [16 target](https://developer.android.com/about/versions/16/behavior-changes-16)) | Target 36 obrigatório no Play desde 31/08/2026 |

## 7. Itens a verificar em device (backlog de homologação M2)

- [ ] Latência cold start do serviço (p50/p95) em low-end Android 10–16.
- [ ] Precedência entre screening do discador (Google Phone / Samsung Smart Call), da operadora e do nosso app.
- [ ] Bind do serviço com autostart negado (MIUI/HyperOS) e com app "restrito" em bateria (One UI).
- [ ] Comportamento em API 24–28 (papel inexistente).
- [ ] Taxa real de `VERIFICATION_STATUS_PASSED` em operadoras BR (Vivo, Claro, TIM) — STIR/SHAKEN no Brasil
  ainda é limitado; tratar `NOT_VERIFIED` como neutro.
- [ ] Dual SIM: confirmar que `getAccountHandle()` vem nulo no screening.
