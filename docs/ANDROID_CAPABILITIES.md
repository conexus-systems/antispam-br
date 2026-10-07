# ANDROID CAPABILITIES — AntiSpam BR

> O que o Android permite hoje, por versão, e como o AntiSpam BR usa cada capacidade.
> Complemento de `docs/research/ANDROID_LIMITATIONS.md` (foco nas limitações).

## 1. Matriz de capacidades × API level

| Capacidade | API 24–28 | API 29–30 | API 31+ | Uso no app |
|---|---|---|---|---|
| CallScreeningService | ✅ (role manual confuso) | ✅ (RoleManager) | ✅ | Caminho principal de decisão |
| ROLE_CALL_SCREENING via RoleManager | ❌ | ✅ | ✅ | Onboarding: botão "Ativar proteção" |
| `setSilenceCall` (SILENCE) | ❌ | ❌ | ✅ | SILENCE real na API 31+; degrada para WARN/reject antes |
| `getCallerNumber` confiável | ⚠️ | ⚠️ | ⚠️ | Falha → fail-safe ALLOW |
| WorkManager p/ updater | ✅ | ✅ | ✅ | Atualização de base em background |
| POST_NOTIFICATIONS runtime | n/a | n/a | ✅ | Notificações de bloqueio (pedida em runtime) |
| SMS receiver (bloqueio) | ⚠️ (só fora do Play) | ❌ (política) | ❌ (política) | Análise manual de SMS no Play; receiver real só em builds F-Droid/APK |

## 2. Pipeline de decisão (implementado — ver `src/core/`)

```
incoming number
      ↓
normalize (brazilRules + normalize.ts)
      ↓
contacts/allowlist (whitelist)
      ↓
explicit rules (rulesEngine)
      ↓
local reputation DB (localReputation)
      ↓
heuristics (spamScore + brazilRules)
      ↓
campaign analysis (campaignDetector)
      ↓
decision (decisionEngine → ALLOW/WARN/SILENCE/BLOCK)
```

- Fail-safe: qualquer exceção/timeout → **ALLOW**.
- Timeout nativo 1,2 s; cache LRU 30 s.
- Decisão nunca depende de rede.

## 3. Status de implementação neste repositório

| Item | Status |
|---|---|
| Módulo Expo local `modules/antispam-screening` (CallScreeningService real) | ✅ |
| Config plugin (READ_PHONE_STATE, READ_CONTACTS) | ✅ |
| Ponte JS: evento `onIncomingCall` → pipeline → `notifyDecision` | ✅ (7 testes dedicados) |
| SILENCE nativo (API 31+) com degradação | ✅ |
| Homologação em devices reais (RoleManager, OEMs, dual-SIM, p95) | 🔜 M2 (moto g(6) play validado; ampliar devices) |
| Base comunitária assinada + updater | 🔜 M8 |
| SMS engine | 🔜 M4 (heurísticas locais; receiver real só fora do Play) |

## 4. Métricas-alvo

| Métrica | Meta | Como medir |
|---|---|---|
| p95 do pipeline de decisão | < 100 ms | Benchmark no caminho nativo (M2 homologação) |
| Falsos positivos (BLOCK indevido) | < 0,1% das chamadas legítimas | Telemetria opt-in + contestações |
| Taxa de spam bloqueado | > 80% das chamadas classificadas spam | Denúncias confirmadas vs. bloqueios |
| Uptime de proteção (role ativo) | > 99% | Detecção de role revogado no start |
