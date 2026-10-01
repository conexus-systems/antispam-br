# ARCHITECTURE — AntiSpam BR

## 1. Visão geral

```
┌────────────────────────────────────────────────────────────────┐
│                    UI (expo-router, TSX)                        │
│  onboarding · (tabs): início/histórico/verificar/ajustes · doação │
├────────────────────────────────────────────────────────────────┤
│             Camada de aplicação (src/app)                       │
│  store (estado global + AsyncStorage) · screening (ingest)      │
│  backup (JSON validado) · nativeBridge (no-op em Expo Go)       │
├────────────────────────────────────────────────────────────────┤
│                    Núcleo puro (src/core) — 100% testável       │
│  phone/ (normalize BR, emergências, 0303)                       │
│  rules/ (motor de regras)  · decision/ (SpamDecisionEngine)     │
│  detection/ (SpamScore, CampaignDetector)                       │
│  reputation/ (denúncias + anti-abuse)  · database/ (spam DB)    │
│  security/ (sha256, hash-prefix)  · donation/ (PIX EMV+CRC16)   │
│  ai/ (OpenRouter OPCIONAL — nunca na decisão crítica)           │
├────────────────────────────────────────────────────────────────┤
│  Native (development build)  native/android/*.kt                │
│  CallScreeningService → bridge → engine JS → decisão c/ timeout │
└────────────────────────────────────────────────────────────────┘
```

## 2. Fluxo de uma chamada

1. **Nativo** (`AntiSpamCallScreeningService.onScreenCall`) recebe a chamada e pede decisão à ponte (timeout 1,2 s → ALLOW).
2. **JS** (`ingestIncomingCall`) monta `CallContext` (número, apresentação, contatos resolvidos localmente, STIR/SHAKEN).
3. **Engine** (`decide`) executa o pipeline §4 do PRD e devolve `CallDecision` (ação, score, confiança, razões).
4. **Histórico + notificação** registrados localmente; `notifyDecision` devolve a ação ao nativo.
5. **Fail-safe**: exceção em qualquer camada → `ALLOW` + log local.

## 3. Decisões de arquitetura

| Decisão | Justificativa |
|---|---|
| Núcleo puro em TS sem deps RN | Testável em Node (42 testes), portável para módulo nativo futuro |
| Store próprio (`useSyncExternalStore`) + AsyncStorage | Zero dependência de estado; suficiente p/ escala do app |
| AsyncStorage → (futuro) SQLite | Interface `SpamDatabase` já isola storage; migração transparente |
| IA fora do pipeline | Latência + privacidade + auditabilidade; IA só sob demanda com consentimento |
| Hash-prefix (k-anonymity) p/ base comunitária | Nunca transmitir número cru; consultas por prefixo de SHA-256 |
| Deltas assinados (Ed25519) | Integridade da base; rollback por versão; anti database-poisoning |

## 4. Formato aberto da base (§11)

```json
{
  "key": "+551140028922",
  "country": "BR",
  "category": "telemarketing",
  "score": 78,
  "reports": 142,
  "uniqueReporters": 96,
  "firstSeen": "2026-01-01T00:00:00Z",
  "lastSeen": "2026-10-01T12:00:00Z",
  "confidence": 0.87,
  "falsePositives": 2
}
```

## 5. Atualização da base (§12)

```
App start → manifest (versão N) → se N > local → baixar delta
→ verificar assinatura + digest → merge validado → persistir → rollback se falha
```

Trabalho futuro (M8): servidor estático + manifest assinado; WorkManager/expo-task p/ periodicidade (Wi-Fi apenas por padrão).

## 6. Segurança (resumo; detalhes em THREAT_MODEL.md)

- Validação estrita de todo input externo (backup, deltas).
- Sem `eval`, sem WebView, sem links externos em contexto privilegiado.
- Chaves (PIX opcional, OpenRouter do usuário) via env/aparelho — nunca no repo.
- Rate limit + anonimização planejados no backend comunitário (M8).

## 7. Performance (§27)

- Lookup canônico O(1) (Map); campanha janela 10 min limitada a 50 eventos.
- Benchmark planejado: 10k → 5M entradas (latência, RAM, startup) — M14.
- Meta: p95 < 100 ms em aparelho intermediário; nunca aproximar do timeout do sistema.
