# PRD — AntiSpam BR

> Produto: bloqueador de chamadas de spam para o Brasil. Grátis, open source, sem anúncios, privacy-first.
> Plataformas: Android (primário) e iOS (limitado pelas APIs da Apple — ver §9).

## 1. Problema

O Brasil está entre os países com mais chamadas de telemarketing/golpe por habitante. Os apps dominantes vendem dados, exibem anúncios e empurram assinaturas. Falta uma alternativa open source, local-first, explicável e honesta sobre limites.

## 2. Personas

- **Maria, 62** — recebe 8 ligações de "sua operadora" por semana; precisa de proteção forte sem configurar nada.
- **João, 28** — vende na OLX/Mercado Livre; quer saber se pode atender o comprador desconhecido.
- **Ana, 41** — advogada; precisa que **nenhuma** ligação legítima seja bloqueada (fail-safe é requisito, não feature).

## 3. Proposta de valor

| Apps comerciais | AntiSpam BR |
|---|---|
| Vendem seus dados | Nada sai do aparelho (por padrão) |
| Anúncios | Nenhum |
| Assinatura/paywall | Grátis, MIT |
| Caixa-preta | Decisão 100% explicável |
| Nuvem decide | Local decide; nuvem nunca decide |

## 4. Requisitos funcionais (MVP)

1. Onboarding com explicação honesta do papel de filtragem.
2. Pipeline: normalizar → emergências → contatos/whitelist → regras → blacklist → reputação → padrão → campanha → STIR/SHAKEN → score → decisão.
3. Decisões: `ALLOW / WARN / SILENCE / BLOCK` com score 0–100 e razões.
4. Modos: OFF / BASIC / BALANCED / AGGRESSIVE / CUSTOM (limiares + 0303).
5. Whitelist/blacklist/regras (prefixo, regex, ocultos, internacionais, fora-de-contatos, horário).
6. Histórico explicável + denúncia por categoria (anti-abuse).
7. Verificar número sob demanda.
8. Estatísticas (hoje/7d/30d/total; tempo poupado = estimativa rotulada).
9. Backup JSON validado.
10. Doação PIX (BR Code gerado no aparelho; chave via env de build).
11. IA Assistente **opcional** (OpenRouter, chave do usuário, off por padrão, nunca decide bloqueio).
12. Base local com formato aberto; deltas assinados (fase comunitária).

## 5. Requisitos não-funcionais

- **Latência**: p95 decisão local < 100 ms em aparelho intermediário.
- **Fail-safe**: qualquer erro → ALLOW. O pior erro é bloquear ligação legítima (§35).
- **Bateria**: sem polling; só eventos de chamada.
- **Privacidade**: minimização; nenhuma telemetria; LGPD by design.
- **Acessibilidade**: contraste AA, alvos ≥ 44pt, textos pt-BR claros.

## 6. Métricas de sucesso

- ≥ 95% das chamadas de spam conhecido bloqueadas com < 0,5% de falso-positivo na base de teste.
- p95 < 100 ms (benchmark em device, M14).
- Crash-free ≥ 99,8%.

## 7. Fora de escopo (por princípio)

- Venda de dados, anúncios, perfilamento do usuário.
- Cloud ML decidindo bloqueios.
- Rastrear/publishing de dados pessoais de terceiros (ver §10).

## 8. Critérios de aceite (amostra)

- `190` nunca é bloqueado em nenhum modo (teste: `decisionEngine.test.ts`).
- `(11) 99999-9999`, `11999999999`, `+5511999999999` → mesmo canônico (teste: `normalize.test.ts`).
- 1 denúncia isolada não bloqueia; 20 denunciantes únicos de fraude → score > 80 (teste: `reputation.test.ts`).
- Base corrompida → ALLOW + app funcional (teste: fail-safe).

## 9. iOS — limitações honestas

A Apple não expõe screening em tempo real. MVP iOS: bloqueio por lista via **Call Directory Extension** (limite de itens, atualização em lote), identificação no app e simulação. Documentado como expectativa realista, não promessa de paridade.

## 10. Avaliação de viabilidade — pedidos avançados

| Pedido | Veredito | Como faremos |
|---|---|---|
| SMS spam | ⚠️ Parcial | Android 6–8: SmsReceiver; Android 9+: sem acesso geral a SMS da Play Store (politica). Solução honesta: **encaminhar manualmente** ao app p/ análise + guia. |
| "Modo troll" | ✅ Viável | Resposta automática opcional (SmsManager pós-dev build; iOS não suporta) — por padrão OFF, com aviso legal de uso responsável. |
| Gravação c/ análise de áudio | ❌/⚠️ | Android bloqueou gravação de ambas as vozes (API 24+); iOS proíbe. Alternativa: análise do que o **usuário ditar** (opcional). |
| Localizar quem liga | ❌ (legal) | Impossível via API pública e violaria LGPD (dados de terceiros). NÃO faremos. |
| Cruzar dados públicos p/ endereço | ❌ (legal) | Doxxing — LGPD art. 5/7; risco de abuso. Oferecemos **dossiê local** (score, denúncias, motivos) para B.O. |
| Alertar polícia | ⚠️ | Sem API de emergência p/ apps. Oferecemos botão "gerar dossiê p/ B.O." + link 190/181. |
| Integração OLX/ML | ⚠️ | Sem API pública p/ relatar número. Faremos: **Verificar número** + cópia de texto p/ suporte da plataforma + futura parceria formal (opt-in). |
| E-mails/WhatsApp do perfil | ❌/⚠️ | Dados de terceiros via OSINT = LGPD. Faremos apenas: usuário classifica manualmente um contato/número com etiquetas locais. |

## 11. Story map (alto nível)

- **Épico Proteção**: onboarding → papel concedido → chamadas protegidas → explicabilidade.
- **Épico Comunidade**: denunciar → base crescer → deltas assinados → reputação coletiva.
- **Épico Confiança**: docs de privacidade, fail-safe auditável, benchmark público.
