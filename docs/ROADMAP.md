# ROADMAP — AntiSpam BR

## Estado atual (entregue neste MVP)

- ✅ M1 Skeleton (Expo + TS + router + tema + componentes)
- ✅ Motor completo (M3 whitelist/blacklist, M4 regras, M5 base local, M6 BR engine, M7 histórico, M9 campanhas)
- ✅ SpamScore auditável + fail-safe + explicabilidade (42 testes)
- ✅ Denúncias locais com anti-abuse (M8 local)
- ✅ Doação PIX BR Code (M12) · IA opcional OpenRouter · backup validado
- ✅ E2E ponta a ponta no Expo Go SDK 57 (emulador headless): 5 cenários via deep link `--/simulate` validando BLOCK/SILENCE/ALLOW — `npm run e2e`
- ✅ Docs (RESEARCH, PRD, ARCHITECTURE, THREAT_MODEL, PRIVACY) · CI (build+tests)
- ✅ **M2 (Android)**: CallScreeningService real via módulo Expo local (autolinking) + APK release standalone instalado em device (moto g(6) play, Android 8) — 51 testes
- ✅ **M4 — SMS Scam Engine**: pipeline local completo (`src/core/sms/`): normalização → URLs (encurtadores, IP, punycode/homoglifos, TLDs abusados, impersonação de marcas) → heurísticas (PIX, boleto, falso banco/entrega/suporte, urgência, senha, OTP, marketing) → score 0–100 → SAFE/SUSPECT/SCAM. Corpus anonimizado com os 7 tipos exigidos (`data/sms-corpus/`) + 32 testes dedicados (83 no total). Texto nunca sai do device (só bodyHash opt-in).
- ✅ **Research/agentes/data**: `docs/research/` (5 docs), capabilities/limitations Android+iOS, legal review, fontes BR, 13 agentes (ROLE/TASKS/DECISIONS) + ORCHESTRATOR, `data/schemas` + regras seed + CI com license scan/SBOM/dataset validation
- ✅ **M8 — Base comunitária + API**: `services/api/` — reputation engine server-side (thresholds configuráveis, decaimento 14d, saturação log), anti-abuse completo (min 2 denunciantes, burst filter, replay, dedup, reporter weight, outlier, quarentena), manifest Ed25519 com anti-rollback, 7 endpoints v1 (Express) + schema Postgres particionado + MV. 21 testes (reputation/anti-abuse/Ed25519/HTTP).
- ✅ **Tela SMS no app**: `app/(tabs)/sms.tsx` reusa `analyzeSms` — análise on-device com veredito, links, sinais e nota de privacidade.
- ✅ **iOS-2 (referência Swift)**: `ios/AntiSpamMessageFilter/` — port das heurísticas p/ ILMessageFilterExtension (mesmos pesos/thresholds do TS; sem rede nesta fase).
- ✅ **M5 — Portal comunitário**: `apps/web/index.html` — consultar (hash local SHA-256 no browser), denunciar, contestar, campanhas, datasets assinados, docs da API. Sem dados pessoais; servido pela própria API (`GET /`) + 1 teste. CI ganha job `backend`; `infra/docker/` sobe API + Postgres 16 com schema aplicado e validado (partição/FK composta/MV).

## Próximos marcos

### M2 — CallScreeningService real (Android ✅ · iOS pendente)
- ✅ Módulo Expo local `modules/antispam-screening` (autolinking, zero config manual): papel ROLE_CALL_SCREENING, evento `onIncomingCall`, `notifyDecision`.
- ✅ Serviço real com fail-safe ALLOW, timeout 1,2 s (nunca perto do timeout do sistema), cache LRU de decisões (30 s) e SILENCE nativo via `setSilenceCall` (API 31+).
- ✅ Ponte JS (`nativeBridge` + `nativeBridgeEvents`): evento → pipeline local → decisão devolvida ao nativo; fonte única de resposta; 7 testes novos (51 no total).
- ✅ Config plugin `plugins/withAntiSpamScreening.js` (READ_PHONE_STATE, READ_CONTACTS).
- ✅ Build standalone validado: `npx expo prebuild --platform android` + `:app:assembleRelease` → APK com JS embutido, sem Expo Go, serviço visível no `dumpsys telecom`.
- 🔜 Homologação em Android 10+ (RoleManager em devices reais, cenários de operadoras,benchmark p95 no caminho nativo).
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
| **SMS spam** | ✅ **M4 entregue** (motor local) · ⚠️ ingestion (políticas Play) | Motor completo em `src/core/sms/` já analisa qualquer texto localmente. Android ≤8 receiver real; Android 9+: análise de SMS **encaminhado manualmente** pelo usuário. iOS: porta para ILMessageFilterExtension (mesmas heurísticas). |
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
