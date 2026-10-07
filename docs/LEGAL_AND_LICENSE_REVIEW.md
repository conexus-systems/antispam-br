# LEGAL AND LICENSE REVIEW — AntiSpam BR

> Revisão legal de licenças, fontes de dados e conformidade regulatória (Brasil).
> **Decisão geral**: licença MIT para o projeto; **zero código** de projetos copyleft reaproveitado;
> apenas análise conceitual de projetos GPL e produtos proprietários.

## 1. Inventário de licenças dos projetos pesquisados

| Projeto / fonte | Licença | Podemos ver código? | Podemos copiar código? | Podemos imitar conceito? |
|---|---|---|---|---|
| aj3423/SpamBlocker | GPL-3.0 | Sim | ❌ (contaminaria MIT) | ✅ |
| Yet Another Call Blocker + forks | GPL-3.0 | Sim | ❌ | ✅ |
| Blockers F-Droid (família) | GPL/Apache/MIT (caso a caso) | Sim | Só Apache-2.0/MIT, com atribuição | ✅ |
| Truecaller, Hiya, Whoscall | Proprietária | ❌ | ❌ | ✅ (conceitos não funcionais: UX, metáforas) |
| Should I Answer? | Proprietária | ❌ | ❌ | ✅ |

**Regra do repositório**: qualquer contribuição de código trazida de outro projeto precisa registrar origem
e licença aqui antes do merge. Padrão: implementação própria do zero.

## 2. Licenças de dependências do app (npm)

| Categoria | Licenças típicas | Ação |
|---|---|---|
| Expo/React Native core | MIT | OK |
| Bibliotecas JS de terceiros | MIT/BSD/Apache-2.0 | OK — verificação automática no CI (license scan) |
| Qualquer GPL/AGPL detectada | GPL | **CI falha** — bloquear adoção |

Ver ferramenta no CI: `license-checker` (allowlist MIT, Apache-2.0, BSD, ISC, 0BSD, CC0-1.0, Unlicense).

## 3. Fontes de dados brasileiras — avaliação de redistribuição

| Fonte | Termo de uso | Redistribuível? | Decisão |
|---|---|---|---|
| Denúncias dos nossos usuários (opt-in) | Nossos termos + LGPD | ✅ apenas agregado/anonimizado | Fonte primária |
| Anatel — dados regulatórios | Dados abertos (quando publicados como open data) | ⚠️ verificar dataset a dataset | Somente open data com licença explícita |
| Não Me Perturbe | Registro individual, sem API pública | ❌ | Referência conceitual apenas |
| Sites agregadores de reputação (Qual Empresa Me Ligou etc.) | Proíbem scraping | ❌ | Não usar; não fazer scraping |
| STIR/SHAKEN / Origem Verificada | Sinal da operadora, não dataset | n/a | Sinal opcional em runtime, não armazenamos |

**Regra anti-scraping**: antes de qualquer coleta automatizada: (1) verificar robots.txt; (2) verificar termos;
(3) procurar API oficial; (4) avaliar LGPD; (5) se tudo incerto, **não coletar**.

## 4. LGPD — checklist de conformidade do produto

- [x] Base legal documentada por tratamento (consentimento p/ denúncias; legítimo interesse p/ processamento local)
- [x] Minimização: sem agenda, sem histórico completo, sem conteúdo desnecessário
- [x] Hashing/anonimização em dados comunitários (k-anonymity nos lookups remotos)
- [x] Opt-in explícito para telemetria e denúncias
- [ ] DPO/canal do titular no portal (M5)
- [ ] RIPD (relatório de impacto) antes do beta público (M9)
- [ ] Termos de uso e política de privacidade publicados no portal (M5)

## 5. Riscos legais residuais e mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Número legítimo rotulado como spam (dano reputacional) | Média | Contestação de 1ª classe; score nunca 100%; explicabilidade; threshold conservador para BLOCK |
| Uso da base para assédio/doxxing | Baixa | Nunca expor nome/endereço (não temos esses dados); portal só mostra agregados; rate limit |
| Exigência da Play sobre CallScreeningService | Alta se mal documentada | Listagem com função principal explícita; política de dados "não coletamos" |
| Reivindicação de propriedade intelectual por imitação | Baixa | Conceitos não são protegidos; zero código/asset/UX copiado; arquitetura própria documentada |

## 6. Decisões finais

1. **MIT** para todo o código do repositório.
2. Datasets públicos: **CC0 / ODbL declarado por arquivo** no manifest.
3. Código GPL: leitura permitida para estudo; cópia proibida; PRs com código copiado serão rejeitados pelo REVIEWER.
4. Sem scraping de fontes que proíbem; sem dados pessoais de terceiros além do número analisado.
