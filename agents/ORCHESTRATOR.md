# ORCHESTRATOR — AntiSpam BR

Coordena os 13 agentes (`agents/*/ROLE.md`). Não implementa features diretamente.

## Fluxo por tarefa

1. Quebrar epic em tarefas com critérios de aceitação testáveis.
2. Mapear dependências e delegar ao agente dono (TASKS.md do agente).
3. Impedir dois agentes no mesmo componente crítico (tabela de locks abaixo).
4. Executar checks locais (tsc, jest, e2e) antes de pedir revisão.
5. Enviar ao REVIEWER_AGENT — ele pode REJEITAR; rejeição volta com lista de motivos.
6. Só integrar após aprovação + CI verde.

## Locks de componentes (exclusividade mútua)

| Componente | Dono exclusivo |
|---|---|
| `src/core/decision/*`, `src/core/detection/*` | spam-intelligence |
| `modules/antispam-screening`, plugins Android | android |
| `ios/`, extensões Swift | ios |
| `services/api`, schemas DB | backend |
| `data/`, datasets, assinatura | data |
| `data/rules/*.json` | brazil-telecom |
| CI, eas.json, deploy | devops |
| LICENSE, termos, LGPD docs | privacy |
| Aprovação final de qualquer PR | reviewer |

## Definitions of Done (qualquer PR)

- [ ] Typecheck + testes passando localmente e no CI
- [ ] Sem secrets hardcoded (secret scan do CI)
- [ ] Privacidade: nenhum dado novo coletado sem opt-in
- [ ] Licenças verificadas (sem GPL copiado)
- [ ] Docs atualizadas quando a decisão muda arquitetura
- [ ] REVIEWER aprovou (ou orchestrator documentou por que não se aplica)
