# IOS LIMITATIONS — AntiSpam BR

> Fontes: Apple Developer (`CallKit`, `Call Directory Extension`, `IdentityLookup`/`ILMessageFilterExtension`, `Live Caller ID Lookup`).
> O iOS **não** tem paridade com o Android — cada limitação define o que o app consegue prometer na plataforma.

## 1. Matriz de capacidades iOS

| Recurso | Framework | O que dá para fazer | Limitação dura | Impacto no AntiSpam BR |
|---|---|---|---|---|
| Bloqueio por lista | Call Directory Extension | Informar blocos de números a bloquear/identificar; sistema aplica localmente | Sem callback por chamada; extensão só *escreve* a lista (até ~5 MB de dados comprimidos); atualização em lote | M6 iOS: bloqueio funciona, mas baseado em listas atualizadas periodicamente (dataset/denúncias locais), não em decisão por chamada |
| Identificação de chamada | Call Directory | Rótulo ("Spam — Telemarketing") na tela de chamada | Mesma lista, sem lógica em runtime | Rótulos vindos do score local pré-calculado |
| Screening em tempo real | **Não existe** | — | iOS não permite interceptar/decidir por chamada como `CallScreeningService` | **BLOCK/WARN/SILENCE por chamada é impossível no iOS** — fluxo é lista → sistema aplica |
| Live Caller ID Lookup | iOS 18+ | Consulta de identidade de chamador com dados do app, com API dedicada e privacy-preserving | Requer entitlement próprio, disponibilidade regional e complexidade de provisioning | 🔜 avaliar pós-M6 (fallback: Call Directory clássico) |
| Filtro de SMS | ILMessageFilterExtension | Classificar SMS em legítimo / indesejado / permitido; pode consultar rede própria com sobrescrever estado | Categoria limitada; sem acesso ao texto completo para o app (sistema mantém conteúdo); rede precisa de endpoint homologado pela Apple | SMS scam engine iOS: heurísticas locais na extensão (URLs, padrões) funcionam; ML pesado fica limitado pelo orçamento de memória da extensão |
| Rede no filtro | ILMessageFilter | `deferred` para consulta ao servidor do app | Endpoint deve implementar contrato da Apple; sem dados pessoais extras | Consulta por hash-prefix (k-anonymity), nunca texto completo |

## 2. Consequências de produto (iOS)

1. **Proposta de valor diferente por plataforma**: Android = bloqueio ativo por chamada; iOS = rótulos + bloqueio por lista + filtro de SMS. A documentação e a loja devem refletir isso (evitar 1-star por expectativa errada).
2. **Atualização de lista é o caminho crítico no iOS** — background app refresh + job após cada atualização de dataset local.
3. **Limite de memória da Call Directory Extension** (~50–70 MB em testes comuns) define o tamanho da base embarcada; delta updates assinados são ainda mais importantes.
4. **Sem analytics por chamada no iOS** — estatísticas do app no iOS vêm de notificações locais agendadas quando a lista é aplicada + input manual do usuário.

## 3. Limitações compartilhadas (ambas plataformas)

- Números privados/ocultos não são filtráveis por API.
- SMS de "remetente empresarial verificado" não é distingui­vel no app (sem API).
- Nada de leitura de áudio de chamada (legal/técnico) — alternativas no ROADMAP ("recursos avançados").

## 4. Checklist de conformidade App Store

- [ ] `Call Directory Extension` com uso descrito na metadata (sem screenshot enganoso de "identificador de chamadas em tempo real").
- [ ] Info.plist keys: `NSExtension` correto na extensão; App Groups entre app e extensão para compartilhar a lista.
- [ ] Privacy Manifest (`PrivacyInfo.xcprivacy`) declarando APIs de sistema usadas (App Groups, UserDefaults compartilhado).
- [ ] Sem promessa de bloqueio de SMS em cena de loja sem demonstrar o filtro do sistema.
- [ ] Números de emergência nunca incluídos nas listas (double-check na geração).
