# ANDROID CAPABILITIES — AntiSpam BR

> O que o Android permite hoje, por versão, e como o AntiSpam BR usa cada capacidade.
> Limitações detalhadas e fontes: `docs/research/ANDROID_LIMITATIONS.md`.
> Última revisão das fontes oficiais: 2026-10-07.

## 1. Matriz de capacidades × API level

| Capacidade | API 24–28 | API 29 | API 30 | API 31+ | Fonte |
|---|---|---|---|---|---|
| `CallScreeningService` (classe) | ✅ (na prática só discador padrão — a verificar) | ✅ | ✅ | ✅ | [CallScreeningService](https://developer.android.com/reference/android/telecom/CallScreeningService) |
| `RoleManager.ROLE_CALL_SCREENING` | ❌ | ✅ | ✅ | ✅ | [RoleManager](https://developer.android.com/reference/android/app/role/RoleManager#ROLE_CALL_SCREENING) |
| `setDisallowCall` / `setRejectCall` / `setSkipNotification` | ✅ | ✅ | ✅ | ✅ | [CallResponse.Builder](https://developer.android.com/reference/android/telecom/CallScreeningService.CallResponse.Builder) |
| `setSkipCallLog` | só operadora/sistema | idem | idem | idem | idem |
| `setSilenceCall` (SILENCE) | ❌ | ✅ | ✅ | ✅ | idem |
| `setRejectedAsMissed` | ❌ | ✅ | ✅ | ✅ | idem |
| `Call.Details.getCallDirection()` | ❌ | ✅ | ✅ | ✅ | [Call.Details](https://developer.android.com/reference/android/telecom/Call.Details) |
| `getCallerNumberVerificationStatus()` (STIR/SHAKEN) | ❌ | ❌ | ✅ | ✅ | idem |
| `ROLE_SMS` (app SMS padrão) | ❌ (API 19 `Telephony.Sms.getDefaultSmsPackage`) | ✅ | ✅ | ✅ | [RoleManager](https://developer.android.com/reference/android/app/role/RoleManager#ROLE_SMS) |
| `POST_NOTIFICATIONS` runtime | n/a | n/a | n/a | 33+ | [Notification permission](https://developer.android.com/develop/ui/views/notifications/notification-permission) |
| WorkManager periódico (mín. 15 min) | ✅ | ✅ | ✅ | ✅ | [Define work](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work) |
| OTP redaction p/ NotificationListener | ❌ | ❌ | ❌ | 35+ | [Android 15](https://developer.android.com/about/versions/15/behavior-changes-all) |

## 2. Mapeamento das ações do produto → API

| Ação AntiSpam BR | `CallResponse` | API mínima | Observação |
|---|---|---|---|
| `ALLOW` | builder vazio | 24 | Default e **fail-open** |
| `WARN` | builder vazio + notificação local/overlay de caller ID | 24 | Doc: "If your app provides a caller ID experience, it should launch an activity … from `onScreenCall`" ([CallScreeningService](https://developer.android.com/reference/android/telecom/CallScreeningService)). Activity em background tem restrições (BAL) — preferir notificação de alta prioridade; **a verificar em device** |
| `SILENCE` | `setSilenceCall(true)` (sem disallow) | **29** | Chamada aparece no discador sem tocar |
| `BLOCK` | `setDisallowCall(true)` + `setRejectCall(true)` + `setSkipNotification(true)` | 24 | `setSkipCallLog` é ignorado para terceiros; bloqueio fica no call log como `BLOCKED_TYPE` |
| `BLOCK` "como perdida" | + `setRejectedAsMissed(true)` | 29 | Exige disallow + reject, senão `IllegalStateException` |

Em API < 29, `SILENCE` degrada para `WARN` (nunca para `BLOCK` — falso positivo custa mais que spam).

## 3. Pipeline de decisão (caminho nativo, sem rede)

```
onScreenCall(details)                     ← bind do Telecom, prazo 5 s (doc oficial)
  ├─ direction != INCOMING → respondToCall ignorado; só caller ID opcional
  ├─ handle = details.handle (tel:)       ← ocultos/privados nem chegam aqui
  ├─ normalize E.164 BR (DDD, 9º dígito, 0300/0303/0800)
  ├─ emergência (190/192/193/199…) → ALLOW imediato
  ├─ allowlist do usuário (DataStore/Room)
  ├─ regras explícitas do usuário (prefixo/DDD/0303)
  ├─ lookup no shard do DDD (arquivo ordenado, mmap, busca binária)
  ├─ sinal STIR/SHAKEN (API 30+): FAILED → +peso; PASSED → −peso; NOT_VERIFIED → neutro
  ├─ score → ALLOW / WARN / SILENCE / BLOCK
  └─ respondToCall(...)                   ← watchdog interno 1,2 s → ALLOW
```

- **Orçamento:** p95 < 50 ms com processo quente; cold start total < 1,2 s (watchdog). Ambos precisam de
  medição em device (backlog M2).
- **Fail-open:** exceção, shard ausente, assinatura inválida, timeout interno → `ALLOW`.
- **Nunca** HTTP durante a chamada. Denúncias e telemetria opt-in são enfileiradas e enviadas depois via WorkManager.

## 4. Onboarding do papel

1. Tela explicando o que o app vê (só número de não-contatos, só no aparelho).
2. `RoleManager.isRoleAvailable(ROLE_CALL_SCREENING)` → se `false` (API < 29 ou OEM sem suporte), mostrar
   modo "somente análise manual".
3. `startActivityForResult(createRequestRoleIntent(ROLE_CALL_SCREENING))` → tratar `RESULT_CANCELED`.
4. A cada `onResume`: `isRoleHeld` → banner "Proteção desativada" se revogado (outro app pegou o papel).
5. Passo opcional por OEM (Xiaomi autostart, Samsung "Sem restrições" em bateria) com deep link para
   Configurações — só se a homologação provar necessidade.

## 5. Atualização do dataset (WorkManager)

| Parâmetro | Valor | Fonte / razão |
|---|---|---|
| Tipo | `PeriodicWorkRequest`, `ExistingPeriodicWorkPolicy.KEEP` | Mínimo 15 min ([doc](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work)); usaremos 12–24 h |
| Constraints | `NetworkType.UNMETERED` (snapshot) / `CONNECTED` (delta pequeno), `requiresBatteryNotLow`, `requiresStorageNotLow` | Delta é poucos KB; snapshot por DDD pode ser MB |
| Backoff | exponencial | Doze e OEMs adiam; tolerável |
| Escopo | só shards dos DDDs habilitados (DDD do SIM + escolhidos) | Menos dados, menos disco |
| Aplicação | baixar → verificar assinatura Ed25519 + hash → gravar `shard.tmp` → `rename` atômico → invalidar mmap | Leitura do screening nunca vê arquivo parcial |
| Expedited | Botão "Atualizar agora" (`setExpedited`) | Interação explícita do usuário |

## 6. SMS por canal de distribuição

| Canal | Abordagem | Motivo |
|---|---|---|
| **Google Play** | (1) Share sheet: `ACTION_SEND` `text/plain` + `ACTION_PROCESS_TEXT` ("Verificar com AntiSpam BR"); (2) colar texto no app; (3) análise 100% local | Sem permissão restrita; política SMS/Call Log só libera `RECEIVE_SMS` para handler padrão ou exceção temporária ([política](https://support.google.com/googleplay/android-developer/answer/10208820)) |
| Google Play (futuro, opcional) | Pedido de exceção "Caller ID, spam detection, and/or spam blocking" para `RECEIVE_SMS` | Só depois de histórico público; risco de rejeição; exige Permissions Declaration Form |
| **F-Droid / APK** | Flavor `foss` com `RECEIVE_SMS` opt-in → classifica e notifica (não apaga SMS; não é handler padrão) | Sem política Play; ainda assim opt-in explícito e local |
| Ambos (descartado) | `NotificationListenerService` | Lê todas as notificações; OTP redaction (15+); Restricted settings (13+ sideload) |

## 7. Play Console — checklist

- [ ] **Permissions Declaration Form**: não necessário enquanto não houver permissões SMS/Call Log no manifesto
  do flavor Play (verificar merge de manifestos de libs).
- [ ] **Data safety**: declarar "nenhum dado coletado" no caminho padrão; se telemetria/denúncia opt-in, declarar
  "Phone number (do denunciado)" como coletado, opcional, criptografado em trânsito, não compartilhado,
  deleção possível.
- [ ] Descrição da loja destacando a função principal (caller ID / bloqueio de spam), exigência de
  "core functionality" da política.
- [ ] Target API 36 (obrigatório desde 31/08/2026 — [target-sdk](https://developer.android.com/google/play/requirements/target-sdk)).
- [ ] Política de privacidade com "não vendemos dados" (a política Play proíbe "any transfer that results in a sale").

## 8. Status no repositório

| Item | Status |
|---|---|
| `AntiSpamCallScreeningService.kt` (fail-safe ALLOW, watchdog 1,2 s, cache LRU 30 s) | ✅ |
| SILENCE nativo | ✅ — **ajustar gate de API 31 → 29** |
| Decisão hoje passa pela ponte JS (React Native) | ⚠️ cold start do runtime JS pode estourar o orçamento — ver decisão 3 abaixo |
| Shards por DDD + mmap + updater assinado | 🔜 |
| Homologação OEM / dual SIM / p95 | 🔜 M2 |

## 9. Métricas-alvo

| Métrica | Meta |
|---|---|
| p95 decisão (processo quente) | < 50 ms |
| p95 cold start até `respondToCall` | < 1,2 s (watchdog) |
| `respondToCall` após 5 s | 0 ocorrências |
| Falsos positivos `BLOCK` | < 0,1% das chamadas legítimas |
| Papel ativo entre usuários | > 99% |

## Decisões para o AntiSpam BR

1. **Decisão 100% local, fail-open.** Nenhuma chamada de rede no caminho de `onScreenCall`. Qualquer erro,
   ausência de shard ou estouro do watchdog interno (1,2 s, bem abaixo dos 5 s oficiais) → `ALLOW`.
2. **Formato de dado no caminho crítico:** shard binário por DDD, números como `Int64`/`uint64` ordenados,
   memory-mapped (`FileChannel.map` read-only) com busca binária; metadados/score em array paralelo.
   Room fica para dados do usuário (allowlist, regras, histórico, fila de denúncias), não para o lookup quente.
3. **Lookup em Kotlin puro dentro do serviço.** Não depender do runtime React Native/JS para decidir:
   o JS pode ser usado para UI e para sincronizar configurações, mas a decisão precisa funcionar com processo
   frio sem inicializar o bridge.
4. **Orçamento de decisão:** p95 < 50 ms quente; medir cold start em low-end antes de qualquer otimização.
5. **Não pedir `READ_CONTACTS` por padrão.** Sem ela, contatos nem chegam ao serviço — é a melhor proteção contra
   falso positivo e reduz superfície de privacidade. `READ_PHONE_STATE` e `READ_CALL_LOG`: remover.
6. **SILENCE a partir da API 29** (não 31). Abaixo, degradar para `WARN`.
7. **STIR/SHAKEN como sinal fraco:** `FAILED` aumenta score; `PASSED` reduz; `NOT_VERIFIED` (maioria no BR hoje —
   a verificar) é neutro. Nunca `BLOCK` só por verificação.
8. **Números ocultos ficam fora do escopo** do screening (a plataforma não os entrega) — comunicar isso na UI.
9. **Dual SIM sem distinção por chip** no screening (`getAccountHandle` não vem); regras são por número, não por SIM.
10. **SMS no Play = share sheet + colar texto, local.** Receiver real só no flavor F-Droid, opt-in.
11. **WorkManager diário com constraints** (unmetered para snapshot, battery-not-low), deltas pequenos, troca
    atômica de arquivo; atualização é *best effort* por causa de Doze/OEMs.
12. **Onboarding mostra estado real** (`isRoleHeld`) e instrui passos de OEM apenas quando a homologação comprovar.
