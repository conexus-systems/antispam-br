# AGENTS.md — AntiSpam BR

Leia antes de mudar código:

1. `docs/ARCHITECTURE.md` e os ADRs em `docs/adr/` — decisões já tomadas não são reabertas sem novo ADR.
2. `agents/ORCHESTRATOR.md` — locks de componentes e Definition of Done.
3. `docs/specs/DATASET_FORMAT.md` e `docs/specs/PUBLICATION_POLICY.md` antes de tocar datasets/reputação.

Regras invioláveis:

- Emergência e utilidade pública (1XX, 112, 911) nunca são bloqueadas ou silenciadas.
- Nenhuma decisão de ligação depende de rede; falha → ALLOW.
- BLOCK só com evidência forte (regra do usuário, denúncia própria ou dataset com ≥ 3 denunciantes ponderados).
- Nada da agenda, do histórico ou do texto de SMS vai para servidor.
- Comportamento compartilhado muda primeiro em `data/test-vectors/`.
- Não copie código de projetos GPL/AGPL (ver `docs/LEGAL_AND_LICENSE_REVIEW.md`).

Comandos:

```bash
npm ci && npm test && npm run typecheck && npm run vectors:check
cd apps/android && ./gradlew :engine:test :app:lintDebug :app:assembleDebug
```
