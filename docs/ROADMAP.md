# ROADMAP — AntiSpam BR

## Estado atual (entregue neste MVP)

- ✅ M1 Skeleton (Expo + TS + router + tema + componentes)
- ✅ Motor completo (M3 whitelist/blacklist, M4 regras, M5 base local, M6 BR engine, M7 histórico, M9 campanhas)
- ✅ SpamScore auditável + fail-safe + explicabilidade (42 testes)
- ✅ Denúncias locais com anti-abuse (M8 local)
- ✅ Doação PIX BR Code (M12) · IA opcional OpenRouter · backup validado
- ✅ Docs (RESEARCH, PRD, ARCHITECTURE, THREAT_MODEL, PRIVACY) · CI (build+tests)

## Próximos marcos

### M2 — CallScreeningService real (dev build)
- Integrar `native/android/` ao prebuild (expo-modules-core ou Expo config plugin).
- Bridge evento↔JS com timeout e cache de decisões; testes instrumentados.
- iOS: Call Directory Extension (bloqueio por lista, atualização em lote).

### M8 — Base comunitária
- Servidor estático + manifest assinado (Ed25519), deltas por versão, rollback.
- Opt-in por denúncia; k-anonymity (hash-prefix) nas consultas.
- Rate limit + prova de trabalho leve (anti-Sybil).

### M10 — ML local (opcional)
- Dataset sintético + labels de denúncias opt-in agregadas.
- Regressão logística / gradient boosting leve via ONNX Runtime Mobile (offline).
- Benchmark de false positives antes de habilitar por padrão.

### M11 — Estatísticas avançadas
- 7/30 dias, categorias, "tempo poupado" com metodologia publicada.

### M13 — Auditoria de privacidade/segurança
- Revisão externa do threat model; fuzzing de import de backup/deltas.

### M14 — Performance
- Benchmark 10k→5M entradas; migração para SQLite; p95 < 100 ms documentado.

### M15/M16 — Distribuição
- F-Droid (builds reproducíveis), GitHub Releases, Google Play (políticas de CallScreeningService: demonstrar função principal de bloqueio, política de dados preenchida com "não coletamos").

---

## Avaliação de viabilidade — recursos avançados (pedidos)

| Recurso | Viabilidade | Plano |
|---|---|---|
| **SMS spam** | ⚠️ Parcial (políticas Play) | Android ≤8 receiver real; Android 9+: análise de SMS **encaminhado manualmente** pelo usuário + heurísticas locais. iOS: filtro de SMS via ILMessageFilterExtension (viável!). |
| **Modo troll** (resposta automática a spam) | ✅ Android (SMS); ❌ iOS | Off por padrão; aviso de uso responsável; templates editáveis; nunca responder números de emergência/contatos. |
| **Gravação de chamadas + análise de áudio** | ❌ Android moderno / ❌ iOS | Restrições de plataforma. Alternativa ética: análise de texto **ditado pelo usuário** (opt-in, local). |
| **Rastrear localização de quem liga** | ❌ | Tecnicamente impossível via API pública e ilegal (LGPD) contra terceiros. Não faremos. |
| **Cruzamento com dados públicos p/ endereço** | ❌ | Doxxing. Oferecemos **dossiê local** p/ B.O. (score, razões, timestamps). |
| **Alertar polícia automaticamente** | ⚠️ | Sem API pública; oferecemos botão que gera dossiê + disca 190 (com confirmação do usuário). |
| **Integração OLX / Mercado Livre** | ⚠️ | Sem API pública de reputação de telefone; faremos "Verificar número" + copiar relatório p/ suporte; parceria formal se um dia existir API. |
| **E-mails/WhatsApp vinculados ao número** | ❌ (legal) | OSINT de terceiros viola LGPD; apenas etiquetas locais criadas pelo próprio usuário. |
| **Base P2P / federação** | 🔭 Explorar | Após M8: BitTorrent/IPFS de deltas assinados. |

## Nota de conformidade

Recursos marcados ❌ (legal) não serão implementados — conflitam com LGPD, políticas das lojas e com o princípio privacy-first do projeto. A proposta de valor alternativa (verificar número, dossiê, explicabilidade) entrega o benefício real sem o dano potencial.
