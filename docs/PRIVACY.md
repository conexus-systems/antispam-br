# PRIVACY — AntiSpam BR

**Resumo em uma frase:** por padrão, nada sai do seu aparelho.

## O que o app processa

| Dado | Onde fica | Sai do aparelho? |
|---|---|---|
| Números das chamadas recebidas | Banco local + histórico | ❌ Nunca (por padrão) |
| Contatos (para "é contato?") | Resolvido localmente, sem envio | ❌ Nunca |
| Denúncias | Base local; futura contribuição comunitária é **opt-in por denúncia** | Só se você escolher |
| Histórico | Local, 500 registros, apagável | ❌ |
| Chave PIX de doação | Variável de build (EXPO_PUBLIC_DONATION_PIX_KEY) | Só para gerar o BR Code localmente |
| Chave OpenRouter (IA opcional) | Aparelho (AsyncStorage) | Só para openrouter.ai quando VOCÊ pede análise |

## LGPD

- **Minimização**: só o necessário para a função; nada de identidade real.
- **Finalidade**: dados de chamada servem exclusivamente à proteção local.
- **Sem perfilamento**: nenhuma telemetria, nenhum tracker, nenhum SDK de anúncios.
- Direitos do titular: apagar histórico/base = privacidade restaurada instantânea (nada existe fora do aparelho).

## IA Assistente (opcional)

- Desligada por padrão. Você fornece a chave do OpenRouter; o app envia **apenas o número que você pediu para analisar** e recebe uma opinião rotulada como tal.
- A IA **nunca** participa da decisão de bloqueio (latência, privacidade e auditabilidade).

## Base comunitária (futuro)

- Consultas por **prefixo de hash** (k-anonymity) — o servidor não aprende seus números.
- Contribuições agregadas e opt-in; denúncias nunca incluem seu nome/contato.

## Permissões Android

- `POST_NOTIFICATIONS` — avisar sobre chamadas bloqueadas.
- Papel de **filtragem de chamadas** via RoleManager (concedido por você nas configurações do sistema).
- Nada de acessibilidade, nada de SMS por padrão, nada de localização.
