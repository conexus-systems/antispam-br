# IOS CAPABILITIES — AntiSpam BR

> O que o iOS permite e o plano de implementação nativa (Swift/SwiftUI). Limitações e fontes detalhadas:
> `docs/research/IOS_LIMITATIONS.md`. O iOS **não** executa código do app por chamada — o produto entrega
> rótulos + bloqueio por lista pré-carregada + filtro local de SMS + denúncia nativa.
> Última revisão das fontes oficiais: 2026-10-07.

## 1. Matriz de capacidades

| Capacidade | API | iOS mín. | Uso no AntiSpam BR | Fonte |
|---|---|---|---|---|
| Bloqueio por lista | `CXCallDirectoryExtensionContext.addBlockingEntry(withNextSequentialPhoneNumber:)` | 10 | Números de altíssima confiança | [doc](https://developer.apple.com/documentation/callkit/cxcalldirectoryextensioncontext/addblockingentry(withnextsequentialphonenumber:)) |
| Rótulo na chamada | `addIdentificationEntry(withNextSequentialPhoneNumber:label:)` | 10 | "⚠️ Suspeito: golpe (AntiSpam BR)" | [doc](https://developer.apple.com/documentation/callkit/cxcalldirectoryextensioncontext/addidentificationentry(withnextsequentialphonenumber:label:)) |
| Atualização incremental | `isIncremental`, `removeBlockingEntry(withPhoneNumber:)`, `removeAllBlockingEntries()` (+ equivalentes de identificação) | 11 | Aplicar deltas do dataset | [isIncremental](https://developer.apple.com/documentation/callkit/cxcalldirectoryextensioncontext/isincremental) |
| Recarregar extensão | `CXCallDirectoryManager.reloadExtension(withIdentifier:)` | 10 | Após baixar snapshot/delta | [doc](https://developer.apple.com/documentation/callkit/cxcalldirectorymanager/reloadextension(withidentifier:completionhandler:)) |
| Status de ativação | `getEnabledStatusForExtension(withIdentifier:)` | 10 | Banner "proteção desativada" | [doc](https://developer.apple.com/documentation/callkit/cxcalldirectorymanager/getenabledstatusforextension(withidentifier:completionhandler:)) |
| Abrir Ajustes de bloqueio | `CXCallDirectoryManager.openSettings()` | 13.4 | Onboarding | [doc](https://developer.apple.com/documentation/callkit/cxcalldirectorymanager/opensettings(completionhandler:)) |
| Consulta ao vivo com privacidade | `LiveCallerIDLookupProtocol` + servidor PIR | 18.0 | Fase futura (cauda longa da base) | [doc](https://developer.apple.com/documentation/identitylookup/getting-up-to-date-calling-and-blocking-information-for-your-app) |
| Filtro de SMS | `ILMessageFilterExtension` + `ILMessageFilterQueryHandling` | 11 | Heurísticas locais | [doc](https://developer.apple.com/documentation/identitylookup/sms-and-mms-message-filtering) |
| Categorias promo/transação | `ILMessageFilterAction.promotion` / `.transaction` | 14 | Separar cobrança legítima de golpe | [doc](https://developer.apple.com/documentation/identitylookup/ilmessagefilteraction) |
| Subcategorias | `ILMessageFilterSubAction` + `ILMessageFilterCapabilitiesQueryHandling` | 16 | finance, orders, carrier, publicServices… | [doc](https://developer.apple.com/documentation/identitylookup/ilmessagefiltersubaction) |
| País do destinatário | `ILMessageFilterQueryRequest.receiverISOCountryCode` | 16 | Ativar regras BR só para `BR` | [doc](https://developer.apple.com/documentation/identitylookup/ilmessagefilterqueryrequest/receiverisocountrycode) |
| Defer para rede | `ILMessageFilterExtensionContext.deferQueryRequestToNetwork` | 11 | **Desligado por padrão** | [doc](https://developer.apple.com/documentation/identitylookup/ilmessagefilterextensioncontext/deferqueryrequesttonetwork(completion:)) |
| Denúncia nativa (chamada e SMS) | `ILClassificationUIExtensionViewController` (IdentityLookupUI) | 12 | Fluxo "Denunciar" do sistema → nosso endpoint | [doc](https://developer.apple.com/documentation/identitylookup/sms-and-call-spam-reporting) |
| Compartilhar dados app ↔ extensões | App Groups | 8+ | Shards, config, versão aplicada | [App Groups](https://developer.apple.com/documentation/xcode/configuring-app-groups) |

## 2. Arquitetura

```
iPhone
├── App (SwiftUI)
│   ├── Onboarding: openSettings() p/ Call Directory + instrução p/ filtro de SMS
│   ├── Updater: BGAppRefreshTask / abertura do app → baixa manifest + deltas → verifica Ed25519
│   │            → grava shard novo no App Group (atômico) → reloadExtension()
│   ├── Configurações (DDDs, agressividade, categorias)  → App Group (UserDefaults suite)
│   └── Denúncias manuais (opt-in) → fila local → POST /v1/reports
├── CallDirectoryExtension
│   └── beginRequest: lê shards (mmap) → se isIncremental: aplica delta da versão N→M
│                     senão: emite lista completa em ordem crescente → completeRequest
├── MessageFilterExtension
│   └── handle(_:context:completion:): heurísticas locais (URL, PIX, urgência, remetente) → action/subAction
│                     (somente leitura do App Group; sem rede; sem estatística de volta)
├── ReportingExtension (IdentityLookupUI)
│   └── coleta categoria → ILClassificationResponse → HTTPS (classificationreport:)
└── App Group container  group.br.antispam.app
    ├── shards/<ddd>.bin  (mesmo formato binário assinado do Android — docs/specs/DATASET_FORMAT.md)
    ├── calldir/applied.json  (versão por shard que o sistema confirmou)
    └── settings.plist
```

**Inteligência compartilhada, implementação nativa separada:** formato de dataset, regras BR e
heurísticas de SMS são idênticos ao Android (vetores de teste compartilhados); a camada nativa não.

## 3. Mapeamento das ações do produto

| Ação AntiSpam BR | iOS | Observação |
|---|---|---|
| `BLOCK` | `addBlockingEntry` | Só score muito alto + múltiplos denunciantes; bloqueio é silencioso e invisível no momento |
| `SILENCE` | ❌ — vira `WARN` (rótulo) | Não há "tocar sem som" por número para terceiros |
| `WARN` | `addIdentificationEntry(label:)` | Rótulo curto em PT-BR; contatos do usuário têm precedência |
| `ALLOW` | ausência de entrada | Default |
| Regra de prefixo do usuário | ❌ | Explicar na UI; oferecer bloquear números concretos |
| SMS golpe | `.junk` | Vai para a aba de lixo do Mensagens |
| SMS cobrança/banco legítimo | `.transaction` + `subAction` finance | Reduz falsos positivos |
| SMS promoção | `.promotion` | — |

## 4. Orçamento da Call Directory

| Parâmetro | Proposta inicial | Racional |
|---|---|---|
| Entradas totais (bloqueio + identificação) | começar em **≤ 200 k** e subir após teste em device | Limite real não documentado (`maximumEntriesExceeded`) |
| Seleção | top-N por shard (DDD habilitado) ordenado por confiança × recência | Cobertura onde o usuário recebe chamadas |
| Bloqueio vs rótulo | Bloqueio ≈ 10% dos mais confiáveis; restante como rótulo | Rótulo errado custa menos que bloqueio errado |
| Delta | Só adicionar/remover diferenças quando `isIncremental` | Carga rápida, menos memória |
| Recarga completa | Fallback quando `isIncremental == false` ou erro anterior | Exigência da API |
| Memória | Streaming do mmap; zero arrays grandes | Limite de memória não documentado |
| Ordenação | Gerada **no servidor**; extensão só valida monotonicidade antes de emitir | Evita `entriesOutOfOrder` |
| Mesclagem de fontes | Merge de listas ordenadas (dataset + lista do usuário) em O(n) | Sem duplicatas (`duplicateEntries`) |

## 5. Filtro de SMS — heurísticas locais

| Sinal | Exemplo BR | Resultado |
|---|---|---|
| URL encurtada / domínio recém-visto na lista local | `bit.ly/…`, domínio parecido com banco | `.junk` |
| Chave/código PIX + urgência | "Pague agora para evitar bloqueio" | `.junk` |
| Remetente short code de operadora/banco conhecido | lista local de short codes | `.transaction` / finance ou carrier |
| Linguagem promocional | "oferta", "cupom" | `.promotion` |
| Sem sinal | — | `.none` (deixa o sistema decidir) |

Regras e listas vêm do App Group (escritas pelo app); a extensão só lê. Sem defer para rede.

## 6. Checklist App Store

- [ ] Descrição: bloqueio/identificação de chamadas e filtro de SMS; **sem** prometer triagem em tempo real (2.5.1).
- [ ] Política de privacidade no app e no App Store Connect (5.1.1 (i)); "não vendemos dados".
- [ ] Privacy Nutrition Label: "Data Not Collected" no modo padrão; se denúncia opt-in, declarar número
  denunciado como coletado, não vinculado à identidade ([App privacy details](https://developer.apple.com/app-store/app-privacy-details/)).
- [ ] `PrivacyInfo.xcprivacy` (UserDefaults/App Group — required reason APIs).
- [ ] Não pedir acesso a Contatos (o sistema já dá precedência aos contatos) — 5.1.1 (iii).
- [ ] Números de emergência BR nunca nas listas (teste automático na geração dos shards).
- [ ] Review notes com vídeo: ativação em Ajustes, rótulo em chamada de teste, SMS indo para lixo.
- [ ] Se Live Caller ID: aprovação de endpoint Apple **antes** do submit.

## 7. Plano por fases

| Fase | Entrega |
|---|---|
| iOS-1 (M6) | App SwiftUI + Call Directory com top-N por DDD (recarga completa) + testes de ordenação/duplicata |
| iOS-2 (M6) | Carga incremental (deltas) + `applied.json` + medição de limite de entradas em device |
| iOS-3 (M6) | `ILMessageFilterExtension` com heurísticas locais, categorias e subcategorias (iOS 16+) |
| iOS-4 (M7) | Reporting extension → endpoint de denúncias (HTTPS, associated domain `classificationreport`) |
| iOS-5 (M6+ / pós-M8) | Live Caller ID Lookup: servidor PIR self-hosted + issuer Privacy Pass + pedido à Apple |

## Decisões para o AntiSpam BR

1. **Call Directory é o núcleo**, com **top-N de alta confiança por shard (DDD)**: bloqueio só para o topo da
   confiança; o restante como rótulo de identificação. N começa conservador (≤ 200 k entradas totais) e só sobe
   após medir `maximumEntriesExceeded`, memória e tempo de carga em device.
2. **Atualização incremental por padrão** (iOS 11+), com fallback obrigatório de recarga completa;
   a versão aplicada só é gravada após `completeRequest` bem-sucedido.
3. **Shards ordenados no servidor**, lidos via mmap em streaming na extensão; extensão valida monotonicidade e
   aborta para a versão anterior em caso de erro (fail-open: manter lista antiga, nunca lista vazia por acidente).
4. **Sem regras de prefixo/regex no iOS** — a API não suporta. Faixas como 0303 viram rótulo apenas para números
   concretos observados; a UI explica a diferença para o Android.
5. **`SILENCE` vira `WARN`** (rótulo) no iOS; STIR/SHAKEN não é sinal disponível.
6. **Filtro de SMS só com heurísticas locais**; **sem `deferQueryRequestToNetwork` por padrão** (enviaria remetente
   + corpo do SMS ao servidor). Um eventual opt-in futuro exige revisão de privacidade/LGPD e envio apenas do
   necessário — e mesmo assim o sistema envia o corpo inteiro, então a recomendação é não implementar.
7. **Usar `.transaction` / `.promotion` + subAções** para reduzir falsos positivos em SMS de bancos e operadoras.
8. **Denúncias pelo fluxo nativo** (Reporting extension) via HTTPS para o nosso endpoint, com o mínimo de dados
   (número + categoria); nada acumulado na extensão (container é apagado).
9. **Live Caller ID Lookup como M6+**, com servidor PIR **self-hosted** (base: `apple/pir-service-example`, que a
   Apple declara não-produção) e issuer Privacy Pass próprio; depende de aprovação Apple e cobre a cauda longa
   que não cabe na Call Directory. Sem rede no aparelho, cai para a Call Directory.
10. **Nenhuma permissão de Contatos** e **nenhuma coleta** no modo padrão → Nutrition Label "Data Not Collected".
