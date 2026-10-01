# Contributing — AntiSpam BR

Obrigado por querer ajudar! 🛡️

## Setup

```bash
npm install
npm test          # 42 testes do motor crítico
npm run typecheck
npx expo start    # roda no Expo Go (modo demonstração)
```

## Regras do projeto

1. **Fail-safe é sagrado**: qualquer mudança no motor precisa manter "em dúvida, ALLOW".
2. **Privacy-first**: nenhuma dependência com tracker/analytics; nada sai do aparelho sem opt-in explícito.
3. **Decisões explicáveis**: todo novo sinal precisa entrar em `contributions` com label pt-BR.
4. **Testes**: features do `src/core` exigem testes; bugs exigem teste de regressão.
5. **Sem código de projetos GPL** (compatibilidade MIT) — apenas ideias conceituais.

## Padrões

- TypeScript estrito; componentes pequenos; núcleo puro (sem imports de RN em `src/core`).
- Commits no padrão Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`…).

## Reportando vulnerabilidades

Veja [SECURITY.md](SECURITY.md) — não abra issue pública.
