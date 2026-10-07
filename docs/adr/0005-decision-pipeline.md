# ADR 0005 — Pipeline de decisão on-device

## Contexto

KPI principal: maximizar spam bloqueado **minimizando falsos positivos**. Bloquear a ligação do
médico, do banco legítimo ou de um parente é pior do que deixar passar um telemarketing.

## Decisão

Pipeline síncrono, em memória, executado em thread de background com orçamento de 2 s
(alvo p95 < 50 ms). Qualquer exceção ou estouro de tempo → **ALLOW** (fail-open).

```
número recebido
  → normalize (E.164 BR)                 inválido → segue com sinais "formato inválido"
  → emergência/utilidade pública         ALLOW (hard, nada sobrescreve)
  → contato / allowlist do usuário       ALLOW (hard)
  → regras explícitas do usuário         ação da regra (usuário é soberano)
  → reputação local (dataset assinado)   pontos + evidência forte se publicada
  → heurísticas (0303, STIR/SHAKEN, vizinhança, campanha, oculto, internacional)
  → reputação comunitária em cache       pontos (nunca rede durante a chamada)
  → modelo local (M7, opcional)          pontos limitados
  → score 0–100 → ALLOW / WARN / SILENCE / BLOCK
```

Guardas contra falso positivo:

- **BLOCK exige evidência forte**: regra do usuário, ou registro do dataset publicado com score
  ≥ limiar de bloqueio. Heurísticas sozinhas param em SILENCE.
- Flag `DISPUTED` ou `VERIFIED_ORG` no dataset limita a ação a WARN.
- Cada decisão carrega `reasons[]` legíveis + estágio que decidiu → tela "por que bloqueou?".
- Bloqueio nunca omite o registro de chamadas (`skipCallLog = false`) — o usuário vê e reverte.
- Um toque em "Não é spam" adiciona à allowlist e gera denúncia LEGITIMATE local.

Thresholds por modo (configuráveis):

| Modo | WARN | SILENCE | BLOCK |
|---|---|---|---|
| Conservador | 40 | 70 | 90 |
| Equilibrado (padrão) | 40 | 60 | 80 |
| Agressivo | 30 | 50 | 70 |

## Consequências

- Nenhuma chamada HTTP no caminho crítico.
- Comportamento idêntico entre plataformas verificado por `data/test-vectors/call-decisions.json`.
