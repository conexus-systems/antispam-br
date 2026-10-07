# ADR 0001 — Apps nativos (Kotlin / Swift); protótipo Expo congelado

## Contexto

O MVP inicial foi um app Expo/React Native. A decisão de bloqueio acontecia em JavaScript: o
`CallScreeningService` (Kotlin) emitia um evento para o runtime JS, aguardava a resposta com
timeout de 1,2 s e caía em ALLOW se o JS não respondesse. Problemas:

- Se o processo estiver frio (comum: o sistema faz *bind* do serviço sem a Activity), o runtime
  JS precisa subir inteiro antes da decisão — a latência fica dominada pelo boot do Hermes, e o
  fail-open vira o caminho normal.
- Call Directory Extension e ILMessageFilterExtension no iOS **não executam JavaScript**; a
  inteligência teria que ser reimplementada em Swift de qualquer forma.
- Room, WorkManager e DataStore são o caminho suportado para persistência/atualização em
  background no Android; via ponte RN elas viram camada extra de falha.

## Decisão

- `apps/android`: Kotlin, Jetpack Compose, Room, DataStore, WorkManager, `CallScreeningService`.
  O motor de decisão é um módulo **Kotlin/JVM puro** (`:engine`), testável sem emulador.
- `apps/ios`: Swift/SwiftUI + extensões (Call Directory, Message Filter, Live Caller ID).
- O app Expo é movido para `apps/legacy-expo/`, **congelado** (só correções de segurança) e
  removido quando o Android nativo atingir paridade funcional (M1 + M4).

## Consequências

- Duas implementações nativas do motor. A divergência é controlada por vetores de teste
  compartilhados (ADR 0002), executados no CI de cada plataforma.
- A decisão de chamada não depende de runtime JS nem de rede.
- Contribuidores precisam de Kotlin ou Swift; o portal web e o backend continuam em TypeScript.
