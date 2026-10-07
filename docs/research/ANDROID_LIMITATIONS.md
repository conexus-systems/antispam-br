# ANDROID LIMITATIONS — AntiSpam BR

> Fontes: documentação oficial Android Developers (`CallScreeningService`, `RoleManager`, `BroadcastReceiver`, políticas do Google Play).
> Cada limitação lista **impacto no produto** e **mitigação adotada**.

## 1. Limitações de API por versão

| API / recurso | Min. versão | Limitação | Impacto | Mitigação |
|---|---|---|---|---|
| `CallScreeningService` | API 24 | Só recebe chamadas se for o *role holder*; antes da API 29 o usuário precisa definir como padrão em Configurações (caminho confuso). | Usuário pode instalar e achar que está protegido sem ativar o papel. | Onboarding com passo dedicado: `RoleManager.createIntentRequest ROLE_CALL_SCREENING`; verificação no app ("Você está protegido / não está"). |
| `CallResponse` (reject/silence) | API 24 / 31 | `setSilenceCall` só existe na API 31+; antes só reject (encerra) ou skip. | "Silenciar" spam em Android ≤ 10 não é possível via screening. | SILENCE degrada para BLOCK (reject) ou WARN conforme faixa de score, por versão do SO. |
| `READ_PHONE_STATE` / número da chamada | 29+ | `getCallerNumber` pode vir nulo dependendo da operadora/conexão (ex.: chamadas em rede comagiada). | Sem número, sem decisão. | Fail-safe ALLOW quando número ausente; nunca bloquear por falta de informação. |
| `BroadcastReceiver` SMS_RECEIVED | 19–25 | Apps não podem cancelar a entrega de SMS desde a API 19 (abortBroadcast inefetivo). | Não dá para "bloquear" SMS nativamente. | SMS engine é analítico (avisa/rotula), não impede entrega. |
| Permissão de SMS (SMS/RECEIVE_SMS) | Play Policy | Google Play só concede a apps que são app de SMS padrão, gerenciador padrão ou têm caso de uso verificado. | Não podemos pedir RECEIVE_SMS no Play. | Android ≤ 8: receiver real fora do Play (F-Droid/APK direto); Android 9+: análise de SMS encaminhado manualmente pelo usuário. |
| AccessibilityService p/ leitura de tela de chamada | Play Policy | Uso para bloqueio de chamadas é reprovado na revisão do Play. | Não usaremos. | Descartado por design (também privacy-first). |
| `SmsManager` resposta automática | — | Enviar SMS em background exige SEND_SMS (permissão perigosa + scrutiny do Play). | "Modo troll" (responder spam) é arriscado na loja. | Off por padrão, templates editáveis, nunca para emergências/contatos; disponível só em distribuição fora do Play se necessário. |
| Execução em background / WorkManager | 23+ | Doze e restrições de fabricante (Xiaomi, Huawei) podem matar o updater de base. | Base comunitária fica desatualizada em OEMs agressivos. | WorkManager com backoff + diagnóstico de restrições do OEM no app + instrução ao usuário ("deixar sem otimização de bateria", opcional). |

## 2. Fragmentação de fabricantes (OEM)

| Problema | Onde ocorre | Mitigação |
|---|---|---|
| Kill de serviço em background | Xiaomi/MIUI, Huawei/EMUI, Oppo/ColorOS, Samsung (modo economia extrema) | App exibe tela "Seu fabricante pode suspender a proteção" com link direto para "ignorar otimização de bateria" (sem root). |
| Duas pilhas de telefonia (dual-SIM) | Samsung, Xiaomi | Screening é por chamada, independente de SIM; testar dual-SIM em homologação (roadmap M2). |
| Role de screening perdido após atualização do app | Alguns OEMs | Detectar role revogado no start do app e re-pedir. |

## 3. Políticas Google Play relevantes

1. **CallScreeningService** exige que a função principal do app seja o gerenciamento de chamadas — é o nosso caso (app de bloqueio de spam), mas a listagem precisa deixar isso explícito.
2. **Política de Dados**: declarar coleta mínima (denúncias opt-in com hash; sem agenda, sem histórico completo).
3. **Permissões sensíveis**: READ_CONTACTS é usado 100% local (comparação de allowlist) — declarar no Play que não há upload.
4. **Toggles no app**: usuários devem poder desativar o bloqueio global — já previsto (switch geral).

## 4. Decisões de arquitetura derivadas das limitações

- **Fail-safe ALLOW**: qualquer erro/timeout no pipeline → permitir a chamada (falso negativo é melhor que falso positivo na emergência).
- **Timeout de decisão 1,2 s** no caminho nativo (bem abaixo do timeout do sistema), com cache LRU de 30 s por número.
- **Decisão nunca depende de rede**; rede apenas atualiza base em background (WorkManager).
- **Degradação por versão**: matriz de capacidades por API level, testada em homologação (M2).
