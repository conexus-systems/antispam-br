# ADR 0006 — Reputação e anti-poisoning

## Contexto

Atacantes vão tentar: (a) **limpar** o próprio número (contestações em massa), (b) **sujar** o
número de um concorrente ou de uma pessoa (assédio direcionado), (c) inundar a API com bots
(Sybil), (d) reenviar denúncias capturadas (replay).

## Decisão

Score 0–100 calculado no servidor (`packages/reputation`), determinístico e explicável:

1. **Peso do denunciante** `w ∈ [0, 1]`: começa em 0,3 (dispositivo novo), sobe com tempo de
   vida do token e concordância histórica com o consenso; cai com contestações perdidas;
   0 em quarentena.
2. **Denunciantes distintos ponderados** é a variável principal, não contagem bruta.
   `Σw < 2` → número fica neutro (nenhuma denúncia isolada move o score).
3. **Decaimento temporal** (meia-vida 30 dias) — números reciclados se limpam sozinhos.
4. **Categoria** pondera gravidade (golpe > telemarketing > pesquisa).
5. **Contestações** (LEGITIMATE) ponderadas reduzem; contestação aceita por moderação zera.
6. **Detecção de surto**: se > 70 % do peso chegou em < 1 h vindo de tokens com < 7 dias, o
   número entra em **quarentena de publicação** (score calculado, mas não publicado) até
   moderação ou até o padrão normalizar.
7. **Outliers por denunciante**: token cujo volume diário excede p99 tem peso zerado no dia.
8. **Rate limiting** por token, por /24 (IPv4) e /48 (IPv6), e prova de trabalho leve no
   registro do token (hashcash ajustável).
9. **Replay**: cada denúncia tem `nonce` único + timestamp ±10 min; nonce repetido é descartado.
10. **Labels**: 0–19 CLEAN · 20–39 LOW_RISK · 40–59 SUSPICIOUS · 60–79 SPAM · 80–100 HIGH_RISK
    (configuráveis em `data/rules/categories.json`).

## Consequências

- Uma única denúncia nunca causa bloqueio global (testado).
- Ataque Sybil precisa de muitos tokens envelhecidos — caro e detectável.
- Score é explicável: o breakdown por fator é retornado pela API e mostrado no portal.
