# IOS LIMITATIONS — AntiSpam BR

> Pesquisa de plataforma (iOS) com base em documentação **oficial** da Apple. Cada afirmação traz a URL.
> Onde a Apple não documenta (ex.: limites de memória de extensões), o item está marcado **"a verificar em device"**.
> Complemento: `docs/IOS_CAPABILITIES.md` (capacidades e decisões de design).
> Última revisão das fontes: 2026-10-07.

## 1. Resumo dos limites duros

| Limite | Valor | Fonte |
|---|---|---|
| Decisão por chamada em tempo real pelo app | **Não existe.** A Call Directory é carregada só quando a extensão é lançada; "you can't make a request to a web service to find information about an incoming call" | [Identifying and blocking calls](https://developer.apple.com/documentation/callkit/identifying-and-blocking-calls) |
| Ordem das entradas na Call Directory | Estritamente **crescente** (`withNextSequentialPhoneNumber`); erros `entriesOutOfOrder`, `duplicateEntries` | [CXErrorCodeCallDirectoryManagerError.Code](https://developer.apple.com/documentation/callkit/cxerrorcodecalldirectorymanagererror-swift.struct/code) |
| Máximo de entradas | Existe (`maximumEntriesExceeded`), **valor não documentado** — a verificar em device | idem |
| Carga incremental | iOS **11** (`isIncremental`, `removeBlockingEntry`, `removeAllBlockingEntries`) | [isIncremental](https://developer.apple.com/documentation/callkit/cxcalldirectoryextensioncontext/isincremental), [removeAllBlockingEntries()](https://developer.apple.com/documentation/callkit/cxcalldirectoryextensioncontext/removeallblockingentries()) |
| Abrir Ajustes direto na tela de bloqueio | iOS **13.4** (`CXCallDirectoryManager.openSettings`) | [openSettings](https://developer.apple.com/documentation/callkit/cxcalldirectorymanager/opensettings(completionhandler:)) |
| Live Caller ID Lookup | iOS **18.0** / macOS 15; framework IdentityLookup; exige **validação de endpoint pela Apple** e relays Apple (OHTTP) | [Getting up-to-date calling and blocking information](https://developer.apple.com/documentation/identitylookup/getting-up-to-date-calling-and-blocking-information-for-your-app) |
| Filtro de SMS | iOS 11; só remetentes **desconhecidos**; **não** funciona com iMessage | [SMS and MMS Message Filtering](https://developer.apple.com/documentation/identitylookup/sms-and-mms-message-filtering) |
| Subcategorias de SMS | `promotion`/`transaction` iOS 14; `ILMessageFilterSubAction` iOS 16 | [ILMessageFilterAction](https://developer.apple.com/documentation/identitylookup/ilmessagefilteraction), [ILMessageFilterSubAction](https://developer.apple.com/documentation/identitylookup/ilmessagefiltersubaction) |
| Extensão de filtro de SMS e rede | **Não acessa rede** diretamente; só "defer" via sistema | [ILNetworkResponse](https://developer.apple.com/documentation/identitylookup/ilnetworkresponse) |
| Extensão de filtro e App Group | **Não pode escrever** em containers compartilhados (só leitura) | [SMS and MMS Message Filtering](https://developer.apple.com/documentation/identitylookup/sms-and-mms-message-filtering) |
| Extensão de denúncia | Uma por vez; container **apagado** ao terminar | [SMS and Call Spam Reporting](https://developer.apple.com/documentation/identitylookup/sms-and-call-spam-reporting) |
| Memória da extensão Call Directory | **Não documentado** pela Apple — a verificar em device (projetar para dezenas de MB, não centenas) | — |

## 2. Call Directory Extension (CallKit)

### 2.1 Modelo de execução

- A extensão (`CXCallDirectoryProvider.beginRequest(with:)`) é lançada pelo sistema — após
  `CXCallDirectoryManager.reloadExtension(withIdentifier:)` ou quando o usuário habilita — e entrega **todas**
  as entradas de uma vez ao `CXCallDirectoryExtensionContext`
  ([CXCallDirectoryExtensionContext](https://developer.apple.com/documentation/callkit/cxcalldirectoryextensioncontext)).
- No toque, quem consulta é o sistema, contra a base que ele já armazenou. A extensão **não roda** durante a chamada
  e **não recebe** o número que está ligando.
- Precedência documentada ([Identifying and blocking calls](https://developer.apple.com/documentation/callkit/identifying-and-blocking-calls)):
  - **Identificação:** contatos do usuário primeiro; só sem match o sistema usa a extensão.
  - **Bloqueio:** lista de bloqueio do usuário/sistema primeiro; depois a extensão.
- O usuário precisa **habilitar** a extensão em Ajustes ("Call Blocking & Identification"); o app consulta com
  `getEnabledStatusForExtension(withIdentifier:)` ([doc](https://developer.apple.com/documentation/callkit/cxcalldirectorymanager/getenabledstatusforextension(withidentifier:completionhandler:))).
  Caminho exato da tela em iOS 18+ (Ajustes › Apps › Telefone › …): **a verificar em device**; usar `openSettings()`.

### 2.2 Formato e restrições das entradas

| Restrição | Detalhe |
|---|---|
| Tipo | `CXCallDirectoryPhoneNumber` = `Int64`, "country calling code followed by a sequence of digits" ([doc](https://developer.apple.com/documentation/callkit/cxcalldirectoryphonenumber)). BR: `55` + DDD + número, ex. `5511987654321` |
| Limite superior | `CXCallDirectoryPhoneNumberMax` ([doc](https://developer.apple.com/documentation/callkit/cxcalldirectoryphonenumbermax)) |
| Ordem | Crescente, sem duplicatas, separadamente para bloqueio e para identificação (nome do método: `withNextSequentialPhoneNumber`) |
| Rótulo | `addIdentificationEntry(withNextSequentialPhoneNumber:label:)` — exibido na tela da chamada recebida |
| Prefixo / curinga / regex | **Não suportado** — a API só aceita números completos. Não há método para faixa |
| Erros | `noExtensionFound`, `currentlyLoading`, `loadingInterrupted`, `entriesOutOfOrder`, `duplicateEntries`, `maximumEntriesExceeded`, `extensionDisabled`, `unexpectedIncrementalRemoval` |

**Consequência para faixas brasileiras:** bloquear "todo `0303`" ou um prefixo de call center exige **enumerar**
cada número. Uma faixa de 4 dígitos livres = 10.000 entradas; de 8 dígitos (todo um prefixo 0303 de um DDD) =
100 milhões — inviável. Portanto, no iOS, regras de prefixo do usuário **não** podem ser replicadas; só números
concretos de alta confiança.

### 2.3 Carga incremental (iOS 11+)

- Se `context.isIncremental == true`, a extensão "must only add or remove entries relative to the last time the
  system loaded data"; se `false`, deve adicionar **a lista completa** sem remover nada
  ([isIncremental](https://developer.apple.com/documentation/callkit/cxcalldirectoryextensioncontext/isincremental)).
- `removeAllBlockingEntries()` / `removeAllIdentificationEntries()` só com `isIncremental == true`; caso contrário,
  erro `unexpectedIncrementalRemoval`.
- O sistema decide se a requisição é incremental — o app precisa estar pronto para **ambos** os caminhos
  (delta e recarga completa), e precisa saber qual versão o sistema tem (guardar "última versão aplicada com
  sucesso" no App Group só após `completeRequest`).

### 2.4 Limites práticos (não documentados)

| Item | Situação |
|---|---|
| Número máximo de entradas | `maximumEntriesExceeded` existe; valor não publicado. **A verificar em device** com testes de 100 k / 500 k / 1 M / 2 M entradas |
| Memória da extensão | Não publicado. Ler o shard via mmap e iterar em streaming; nunca materializar arrays grandes de `Int64` em memória |
| Tempo de carga | Não publicado; carga grande pode resultar em `loadingInterrupted`. **A verificar em device** |
| Frequência de reload | Controlada pelo app (`reloadExtension`), mas executada pelo sistema; durante a carga, `currentlyLoading` |

## 3. Live Caller ID Lookup (iOS 18+)

| Aspecto | Detalhe | Fonte |
|---|---|---|
| Framework / tipos | IdentityLookup: `LiveCallerIDLookupProtocol`, `LiveCallerIDLookupExtensionContext` (`serviceURL`, `tokenIssuerURL`, `userTierToken`), `LiveCallerIDLookupManager` (`status`, `openSettings`, `refreshPIRParameters`, `reset`) | [IdentityLookup](https://developer.apple.com/documentation/identitylookup), [LiveCallerIDLookupManager](https://developer.apple.com/documentation/identitylookup/livecalleridlookupmanager) |
| Disponibilidade | iOS 18.0, iPadOS 18.0, macOS 15.0, visionOS 2.0 | idem |
| Info.plist | `NSPIRConfiguration` com `PIRServerURL` e `PrivacyPassIssuerURL` | [Getting up-to-date…](https://developer.apple.com/documentation/identitylookup/getting-up-to-date-calling-and-blocking-information-for-your-app) |
| Requisito Apple | "requires you to use Apple relay servers … This requires endpoint validation from Apple" — formulário de solicitação | idem |
| Privacidade | IP oculto por **Oblivious HTTP** (dois relays de partes diferentes); autenticação anônima por **Privacy Pass**; número oculto por **PIR** (criptografia homomórfica) | [Understanding how Live Caller ID Lookup preserves privacy](https://developer.apple.com/documentation/identitylookup/understanding-how-live-caller-id-lookup-preserves-privacy) |
| Servidor | Precisamos operar servidor PIR com endpoints `/config`, `/key` (upload de evaluation key), `/queries`, protobuf sobre HTTP | [HTTP endpoints](https://developer.apple.com/documentation/identitylookup/setting-up-the-http-endpoints-for-live-caller-id-lookup) |
| O que o servidor vê | Header `User-Identifier` (pseudorrandômico), token Privacy Pass, evaluation key, consulta cifrada. **Não vê** IP nem número. Pode correlacionar consultas pelo `User-Identifier` (frequência de chamadas) | idem |
| Resposta | Bloqueio = 1 byte; identidade = protobuf `CallIdentity` (`name`, `icon` HEIC, `cache_expiry_minutes`, `category` PERSON/BUSINESS) | [Formatting data](https://developer.apple.com/documentation/identitylookup/formatting-data-for-blocking-and-identity-information) |
| Implementação de referência | `apple/pir-service-example` (antigo `live-caller-id-lookup-example`) — "should not be run in production"; Swift 6.1+, Linux/macOS; reload dinâmico de base | [GitHub](https://github.com/apple/pir-service-example), [swift-homomorphic-encryption](https://github.com/apple/swift-homomorphic-encryption) |

**Limitações:** exige rede **no momento da chamada** (feita pelo sistema, não pelo app) — se não houver rede, sem
resultado; depende de aprovação Apple; custo operacional de servidor PIR (CPU de avaliação homomórfica,
armazenamento de evaluation keys por usuário). Disponibilidade por país: **a verificar** no formulário Apple.

## 4. Filtro de SMS — `ILMessageFilterExtension`

| Restrição | Detalhe | Fonte |
|---|---|---|
| Escopo | Só SMS/MMS de **remetentes desconhecidos**; nunca contatos; **nunca iMessage** | [SMS and MMS Message Filtering](https://developer.apple.com/documentation/identitylookup/sms-and-mms-message-filtering) |
| Entrada | `ILMessageFilterQueryRequest`: `sender`, `messageBody`, `receiverISOCountryCode` (iOS 16) | [ILMessageFilterQueryRequest](https://developer.apple.com/documentation/identitylookup/ilmessagefilterqueryrequest) |
| Saída | `ILMessageFilterAction`: `none`, `allow`, `junk` (iOS 11), `promotion`, `transaction` (iOS 14) + `subAction` (iOS 16: transacionais finance/orders/reminders/health/weather/carrier/rewards/publicServices/others; promocionais offers/coupons/others) | [ILMessageFilterAction](https://developer.apple.com/documentation/identitylookup/ilmessagefilteraction), [ILMessageFilterSubAction](https://developer.apple.com/documentation/identitylookup/ilmessagefiltersubaction) |
| Rede | Extensão "can't access the network directly"; `deferQueryRequestToNetwork` faz o sistema enviar **POST JSON** com `sender` e `message.text` ao `ILMessageFilterExtensionNetworkURL` (exige Associated Domains `messagefilter:`) | [deferQueryRequestToNetwork](https://developer.apple.com/documentation/identitylookup/ilmessagefilterextensioncontext/deferqueryrequesttonetwork(completion:)), [Creating a Message Filter](https://developer.apple.com/documentation/identitylookup/creating-a-message-filter-app-extension) |
| Escrita | "can't write data to containers shared with the containing app" — estatísticas/histórico de SMS filtrados **não** voltam para o app | [SMS and MMS Message Filtering](https://developer.apple.com/documentation/identitylookup/sms-and-mms-message-filtering) |
| Um filtro ativo | Usuário escolhe um app em Ajustes › Mensagens (caminho exato em iOS 18+: a verificar) | — |

**Implicação de privacidade do defer:** o **corpo completo do SMS** e o remetente vão para o nosso servidor. Isso
contradiz "privacy-first" e cria obrigação LGPD (dado pessoal de terceiros). Por padrão: **não usar**.

## 5. Denúncia — Unwanted Communication Reporting (IdentityLookupUI)

- `ILClassificationUIExtensionViewController` (iOS 12): o usuário habilita **uma** extensão em Ajustes ›
  Telefone › SMS/Call Reporting; denuncia chamada (deslizar em Recentes › Report) ou SMS (Report Messages)
  ([SMS and Call Spam Reporting](https://developer.apple.com/documentation/identitylookup/sms-and-call-spam-reporting)).
- Respostas: `none`, `reportNotJunk`, `reportJunk`, `reportJunkAndBlockSender` (este adiciona à lista de
  bloqueados do sistema).
- Envio: HTTPS para `ILClassificationExtensionNetworkReportDestination` (Associated Domains `classificationreport:`)
  **ou** SMS para `ILClassificationExtensionSMSReportDestination` (sistema mostra o SMS para o usuário confirmar)
  ([ILClassificationResponse](https://developer.apple.com/documentation/identitylookup/ilclassificationresponse)).
- Container da extensão é **apagado** quando ela termina — não dá para acumular denúncias offline na extensão.

## 6. App Store e privacidade

| Cláusula | Exigência | Fonte |
|---|---|---|
| 2.5.1 | Só APIs públicas, "for their intended purposes", e indicar a integração na descrição | [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) |
| 5.1.1 (i) | Política de privacidade no App Store Connect e dentro do app | idem |
| 5.1.1 (iii) | Minimização de dados; preferir pickers/share sheet a acesso total a Contatos | idem |
| 5.1.1 (iv) | Não forçar consentimento; alternativa se o usuário negar | idem |
| 5.1.2 (i) | Não usar/transmitir dados pessoais sem permissão; divulgar compartilhamento | idem |
| Privacy Nutrition Label | Declarar coleta (inclusive denúncias opt-in) | [App privacy details](https://developer.apple.com/app-store/app-privacy-details/) |

## 7. iOS vs Android — o que o iOS **não** faz

| Capacidade | Android | iOS |
|---|---|---|
| Decisão por chamada, em tempo real, com código do app | ✅ `onScreenCall` (5 s) | ❌ só lista pré-carregada; ou Live Caller ID (servidor PIR, iOS 18+) |
| Silenciar sem bloquear | ✅ `setSilenceCall` (API 29+) | ❌ (só bloquear ou rotular) — opção "Silenciar Desconhecidos" é do sistema, não do app |
| Bloqueio por prefixo/faixa/regex | ✅ lógica livre | ❌ só números completos enumerados |
| Sinal STIR/SHAKEN para o app | ✅ API 30+ | ❌ nenhuma API pública encontrada em CallKit/IdentityLookup |
| Ver histórico de chamadas | ❌ (evitado por política) | ❌ |
| Filtro de SMS de terceiros | ❌ sem API (só handler padrão / exceção Play) | ✅ `ILMessageFilterExtension` (desconhecidos, sem iMessage) |
| Denúncia nativa do sistema | ❌ | ✅ Reporting extension |
| Escrever estatística a partir do filtro | n/a | ❌ extensão só lê o App Group |

## 8. A verificar em device (backlog iOS)

- [ ] Número máximo de entradas da Call Directory e memória da extensão (iPhone mais antigo suportado).
- [ ] Tempo de `reloadExtension` com 100 k / 1 M entradas; ocorrência de `loadingInterrupted`.
- [ ] Caminhos de Ajustes no iOS 18/26 (Telefone e Mensagens foram reorganizados em "Apps").
- [ ] Interação com recursos próprios da Apple (Silenciar Desconhecidos, triagem de chamadas do sistema em versões
  recentes) — documentação de usuário Apple, não de desenvolvedor.
- [ ] Elegibilidade do Brasil para Live Caller ID Lookup no formulário da Apple.
