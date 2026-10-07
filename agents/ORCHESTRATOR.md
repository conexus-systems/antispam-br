# ORCHESTRATOR — AntiSpam BR

Coordena os 13 agentes (`agents/*/ROLE.md`). Não implementa features diretamente.

## Fluxo por tarefa

1. Quebrar epic em tarefas com critérios de aceitação testáveis.
2. Mapear dependências e delegar ao agente dono (TASKS.md do agente).
3. Impedir dois agentes no mesmo componente crítico (tabela de locks abaixo).
4. Executar checks locais (`npm test`, `./gradlew :engine:test :app:lintDebug`, instrumentados quando tocar o app) antes de pedir revisão.
5. Enviar ao REVIEWER_AGENT — ele pode REJEITAR; rejeição volta com lista de motivos.
6. Só integrar após aprovação + CI verde.
7. Ao fim de cada marco: STATUS, IMPLEMENTADO, TESTES, COBERTURA, RISCOS, DÍVIDA TÉCNICA, PRÓXIMAS TAREFAS.

## Locks de componentes (exclusividade mútua)

| Componente | Dono exclusivo |
|---|---|
| `apps/android/engine/**` (pipeline, heurísticas) | spam-intelligence (+ android para I/O) |
| `apps/android/app/**` | android |
| `apps/ios/**` | ios |
| `services/api`, migrations | backend |
| `packages/datasets`, `docs/specs/DATASET_FORMAT.md`, chaves | data |
| `packages/phone-normalizer`, `data/rules/*.json` | brazil-telecom |
| `data/test-vectors/**` | qa (mudança exige aprovação do dono do componente testado) |
| `.github/workflows`, `infra/` | devops |
| LICENSE, termos, LGPD docs | privacy |
| `apps/legacy-expo/**` | congelado — só correções de build |
| Aprovação final de qualquer PR | reviewer |

Regra de ouro: mudança de comportamento compartilhado começa no vetor de teste; Android, iOS e
backend só são atualizados depois que o vetor muda.

## Definitions of Done (qualquer PR)

- [ ] Typecheck + testes passando localmente e no CI
- [ ] Sem secrets hardcoded (secret scan do CI)
- [ ] Privacidade: nenhum dado novo coletado sem opt-in
- [ ] Licenças verificadas (sem GPL copiado)
- [ ] Docs atualizadas quando a decisão muda arquitetura
- [ ] REVIEWER aprovou (ou orchestrator documentou por que não se aplica)
