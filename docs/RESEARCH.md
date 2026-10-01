# RESEARCH — AntiSpam BR

> Metodologia: análise **conceitual** de projetos open source existentes (UX, arquitetura, algoritmos).
> **Nenhum código, asset ou texto foi copiado** — tudo aqui foi implementado do zero (exigência do projeto).

## 1. Projetos analisados

| Projeto | Licença | Stack | Técnicas relevantes | Limitações observadas |
|---|---|---|---|---|
| **aj3423/SpamBlocker** | GPL-3.0 | Kotlin | CallScreeningService, blacklist local por hash, atualização de base via arquivo compartilhado | UI básica; base depende de comunidade externa; sem score composto |
| **Corta-Spam (cpinan)** | GPL | Kotlin/Java | Screening + listas do usuário; foco simples e leve | Sem reputação por score; sem detecção de campanhas |
| **Yet Another Call Blocker** | GPL-3.0 | Java/Kotlin | Base comunitária via DAG (dados agregados), lookup por prefixo de hash | Servidor central legado; UX datada; dependência de rede para dados ricos |
| **CallShield / similares F-Droid** | variadas | Kotlin | Regras por prefixo/regex, bloqueio por horário | Pouca explicabilidade da decisão; sem anti-abuse formal |

*Observação: os projetos GPL não permitem reuso de código em app MIT sem contaminar a licença — por isso **zero código** foi reaproveitado; apenas ideias conceituais (legais de imitar).*

## 2. Aprendizados que adotamos (como ideias próprias)

1. **Decisão local e rápida**: todos os bons blockers decidem offline. Adotamos meta p95 < 100 ms e fail-safe → ALLOW.
2. **Score multi-sinal > lista binária**: listas puras geram falsos positivos; combinamos reputação + campanha + padrão + STIR/SHAKEN + histórico do usuário.
3. **Anti-abuse de denúncias**: denúncia isolada não decide (exigimos denunciantes únicos, recência e penalizamos falso-positivos).
4. **Explicabilidade**: cada decisão carrega razões legíveis (§15 do PRD) — raro em apps do gênero.
5. **Privacidade por design em bases remotas**: hash-prefix/k-anonymity em vez de enviar o número completo.

## 3. O que evitamos

- Copiar strings/UX visual de apps proprietários (Truecaller etc.) — identidade própria.
- AccessibilityService para "detectar chamadas" — invasivo, reprovado pela Play Store sem justificativa.
- Envio do número cru a servidores em cada chamada.
- Reuso de código GPL em app MIT.

## 4. APIs oficiais estudadas

- **Android**: `CallScreeningService` (API 24+, relevante 29+), `RoleManager.ROLE_CALL_SCREENING` (29+), `CallResponse` (disallow/reject/skip log/notification), sinal de verificação de número (quando a operadora expõe).
- **iOS**: `CallDirectoryHandler` (bloqueio por lista de números, limitado a ~k itens por extensão e atualização em lote), sem screening em tempo real — por isso no iOS o MVP entrega bloqueio por lista + identificação no app.
- **STIR/SHAKEN**: no Brasil ainda em implantação regulatória (Anatel); o app trata o sinal como **opcional** no pipeline.

## 5. Fontes de base de spam (fase comunitária)

- Denúncias dos próprios usuários (primária).
- Bases públicas legais de uso (a validar caso a caso quanto a LGPD e termos de uso) — ex.: listas públicas de operadoras/telemarketing regulatório.
- Delta packages **assinados** (Ed25519) com rollback e versionamento — ver ARCHITECTURE.md §atualização.
