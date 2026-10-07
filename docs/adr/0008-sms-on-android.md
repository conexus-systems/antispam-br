# ADR 0008 — SMS no Android sem permissões restritas no MVP

## Contexto

O Android não tem API de filtro de SMS para apps de terceiros (diferente do iOS
`ILMessageFilterExtension`). `RECEIVE_SMS`/`READ_SMS` são restritas pela política de SMS e
Call Log do Google Play: exigem ser o app padrão de SMS ou caber numa exceção aprovada.
Ser app padrão de SMS é um produto inteiro (envio, MMS, RCS, backup) e amplia a superfície de
dados pessoais.

## Decisão

- **M4 (MVP SMS)**: análise **por compartilhamento** — `ACTION_SEND` (texto) e
  `ACTION_PROCESS_TEXT` (menu "AntiSpam BR" ao selecionar texto). Nenhuma permissão de SMS.
  O texto é analisado localmente e descartado.
- **Flavor F-Droid (opcional, M8+)**: `RECEIVE_SMS` opt-in para alerta automático, sem leitura
  de caixa de entrada histórica.
- `NotificationListenerService` **não** será usado no MVP (lê notificações de todos os apps —
  desproporcional ao objetivo).

## Consequências

- Publicação no Play sem formulário de permissão de SMS.
- Proteção de SMS no Android é ativa (usuário pergunta), no iOS é passiva (filtro do sistema).
