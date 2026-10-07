# IOS CAPABILITIES — AntiSpam BR

> O que o iOS permite e o plano de implementação nativa (Swift/SwiftUI). Complemento de
> `docs/research/IOS_LIMITATIONS.md`. O iOS **não** executa decisão por chamada — o produto
> entrega rótulos + bloqueio por lista + filtro de SMS.

## 1. Matriz de capacidades

| Capacidade | Framework | Disponível | Uso planejado |
|---|---|---|---|
| Bloqueio por lista de números | Call Directory Extension | iOS 10+ | Sincronizar BLOCK list gerada do score local + base comunitária |
| Identificação (rótulo) de número | Call Directory Extension | iOS 10+ | "Suspeito — Telemarketing (AntiSpam BR)" |
| Screening por chamada em runtime | — | **Não existe** | Impossível; proposta de valor adaptada |
| Live Caller ID Lookup | LiveCommunicationKit | iOS 18+ | Avaliar pós-M6 (entitlement dedicado) |
| Filtro de SMS | ILMessageFilterExtension | iOS 12+ | Heurísticas locais (URLs, PIX, urgência) + categorização |
| Consulta de rede no filtro | ILMessageFilter (deferred) | iOS 12+ | Hash-prefix lookup (k-anonymity) no nosso endpoint |
| App Groups | — | iOS 10+ | Compartilhar base/lista entre app e extensões |

## 2. Arquitetura planejada (M6)

```
iPhone
├── App (SwiftUI)
│   ├── Dashboard de proteção (lista aplicada, estatísticas)
│   ├── Denúncias (opt-in) → POST /v1/reports
│   └── Configurações (thresholds, categorias)
├── Call Directory Extension
│   └── beginRequest: carrega lista do App Group (binário compactado) → adiciona entradas
├── ILMessageFilter Extension
│   └── heurísticas locais do SMS engine (mesmas regras do Android, portadas)
└── Shared (App Group container)
    └── dataset local (mesmo formato binário assinado do Android)
```

**Inteligência compartilhada, implementação nativa separada** — o formato de dataset e os algoritmos
(score, regras, categorias) são idênticos aos do Android; a camada nativa (Kotlin vs Swift) não.

## 3. Restrições de dimensionamento

| Recurso | Limite | Consequência |
|---|---|---|
| Call Directory data | ~5 MB (comprimido) por tipo | Base embarcada curada: top-N ofensores + lista do usuário; resto via delta updates |
| Extensão (memória) | ~50–70 MB | Sem ML pesado na extensão; ML fica no app principal |
| beginRequest frequency | Sistema decide | Atualizar lista após download de delta + em background refresh |

## 4. Checklist App Store (pré-submit)

- [ ] Metadata: função principal = bloqueio/identificação de chamadas; sem promessa de screening em tempo real
- [ ] `PrivacyInfo.xcprivacy` (App Groups, UserDefaults)
- [ ] App Group `group.br.antispam.app` configurado no app e nas extensões
- [ ] Números de emergência BR nunca nas listas (teste automático na geração)
- [ ] SMS: instrução de ativação do filtro em Ajustes → Mensagens → Filtragem de mensagens desconhecidas
- [ ] Review notes: vídeo curto mostrando lista aplicada + rótulo na chamada

## 5. Plano por fases

| Fase | Entrega |
|---|---|
| iOS-1 (M6) | App SwiftUI + Call Directory (lista do dataset local) + testes unitários da geração de lista |
| iOS-2 (M6) | ILMessageFilter com heurísticas locais (sem rede) |
| iOS-3 | Delta updates assinados consumidos pela extensão |
| iOS-4 | Live Caller ID Lookup (iOS 18+) se provisioning viável |
