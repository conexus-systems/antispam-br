# REPOSITORIES — AntiSpam BR Research

> Registro da pesquisa de projetos open source. Campos por projeto: URL, licença, atividade, linguagem,
> arquitetura, técnicas aproveitáveis (conceituais), banco de dados, privacidade, e restrições de licença.
> **Nenhum código foi copiado** — apenas ideias conceituais (ver `LEGAL_AND_LICENSE_REVIEW.md`).

## 1. Repositórios analisados

### aj3423/SpamBlocker
- **URL**: https://github.com/aj3423/SpamBlocker
- **Licença**: GPL-3.0 · **Linguagem**: Kotlin · **Atividade**: ativo (manutenção contínua)
- **Arquitetura**: app Android nativo; CallScreeningService + banco local (blacklist/whitelist por hash)
- **Técnicas interessantes**: hash de números para listas; import/export de base via arquivo; screening direto sem servidor
- **Limitações**: decisão binária (bloqueia/não bloqueia), sem score; base depende de fontes externas
- **Licença implica**: não podemos copiar código (GPL contaminaria MIT). Ideias conceituais OK.

### Yet Another Call Blocker (yacb)
- **URL**: https://github.com/Chun-PT/yacb-community (família de forks; original `xdtianyu` arquivado)
- **Licença**: GPL-3.0 · **Linguagem**: Java/Kotlin · **Atividade**: baixa (comunidade mantém forks)
- **Arquitetura**: cliente + base comunitária agregada (snapshots por prefixo, servidor central legado)
- **Técnicas interessantes**: distribuição de base em pacotes por prefixo; agregação de denúncias antes de publicar
- **Limitações**: UX datada; servidor central é ponto único; sem assinatura criptográfica dos pacotes
- **Licença implica**: mesma restrição GPL — apenas conceitos.

### Corta-Spam / blockers F-Droid (família)
- **URL**: https://f-droid.org/packages/*/ (categoria "Phone & SMS", ex.: `com.googlecode.cortaspam`)
- **Licença**: variadas (GPL, Apache-2.0, MIT) · **Linguagem**: Kotlin/Java
- **Padrões comuns**: regras por prefixo/regex, horários de bloqueio, SMS receiver em Android ≤ 8
- **Técnica aproveitada**: regras explícitas do usuário têm prioridade máxima (nosso RuleEngine segue o mesmo princípio, implementação própria)
- **Limitações**: pouca explicabilidade; nenhum anti-abuse formal

### Referências proprietárias (análise de produto, não de código)
- **Truecaller / Hiya / Whoscall**: score na nuvem, base proprietária enorme, monetização com dados/anúncios — **é o anti-modelo** que nos diferencia. Aprendizados: UX de identificação em tempo real, onboarding de permissões.
- **Should I Answer? (Android)**: base comunitária híbrida (local + rede), rating por categorias. Conceito de contestação adotado.

## 2. Outras referências técnicas (sem código aproveitável direto)

| Fonte | Tema | O que informou no projeto |
|---|---|---|
| Android Developers — CallScreeningService | Screening oficial | Fluxo incoming → normalize → decide → CallResponse |
| Android Developers — RoleManager | Delegação de papel | Onboarding de ROLE_CALL_SCREENING |
| Apple — Call Directory Extension | Bloqueio iOS | Listas em lote, limite de memória |
| Apple — ILMessageFilterExtension | Filtro SMS iOS | Categorias e contrato de rede |
| STIR/SHAKEN (FCC) / Origem Verificada (Anatel) | Attestation de origem | Sinal opcional no pipeline; não dependemos dele |
| NIST SP 800-63B / OWASP MASVS | Segurança mobile | Threat model, armazenamento local, assinatura de datasets |

## 3. Síntese das escolhas do AntiSpam BR

1. **Score composto determinístico** (não binário) — nenhum OSS pesquisado faz bem.
2. **Base local-first + delta updates assinados** — corrige a fragilidade do modelo yacb (servidor central confiável por fé).
3. **Anti-abuse nativo do motor** — denúncia isolada não decide; tempo + denunciantes únicos + contestações.
4. **Explicabilidade total** — razões por decisão, doc pública de thresholds.
5. **Licença MIT** — maximiza adoção comunitária; por isso **zero código GPL** reaproveitado.
