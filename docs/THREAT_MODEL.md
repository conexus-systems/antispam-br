# THREAT MODEL — AntiSpam BR

## 1. Ativos a proteger

1. **Decisões de bloqueio** — falso positivo bloqueia ligação legítima (maior dano ao usuário).
2. **Dados do usuário** — contatos, histórico de chamadas, chaves (PIX/OpenRouter).
3. **Integridade da base** — database poisoning poderia silenciar empresas ou atacar concorrentes.
4. **Confiança comunitária** — denúncias falsas em massa (Sybil).

## 2. Atores adversários

| Ator | Objetivo | Mitigações |
|---|---|---|
| Golpista | Não ser bloqueado; spoofing | Score multi-sinal, STIR/SHAKEN quando disponível, campanha detector |
| Concorrente | Envenenar base (Sybil) | uniqueReporters, saturação log, recência, falso-positivos penalizam, rate limit futuro |
| Atacante local | Roubo físico | Dados em AsyncStorage local; sem nuvem; backup criptografável (futuro) |
| MITM | Alterar delta da base | HTTPS + assinatura Ed25519 do manifest (M8) + digest por delta |
| App malicioso | Abusar do papel de screening | Papel só via RoleManager do sistema; nunca pedimos mais permissões que o necessário |

## 3. Superfície de ataque e respostas

- **Delta da base (M8)**: validação de schema + assinatura + limites de tamanho; merge rejeita registros malformados (testado em `reputation.test.ts`).
- **Backup JSON**: schema estrito, limite 2 MB, regex validada antes de usar (testado).
- **IA (OpenRouter)**: opt-in, chave só do aparelho, envia apenas o número solicitado; **nunca** no pipeline de decisão.
- **Deep links (scheme antispambr)**: nenhuma ação mutante sem interação explícita.
- **Expo Go**: sem módulo nativo → sem screening real; simulador isolado do sistema.

## 4. Fail-safe (§24)

Qualquer exceção no pipeline → **ALLOW**. O motor captura tudo; o serviço nativo tem timeout (1,2 s) → ALLOW. Registrado localmente para diagnóstico.

## 5. Futuro (base comunitária)

- k-anonymity: cliente consulta por prefixo de hash (8 nibbles); servidor nunca vê o número.
- Contribuições agregadas em lote, com opt-in explícito por denúncia.
- Anti-Sybil: prova de trabalho leve por denúncia + diversidade de denunciantes.
- Auditoria pública do algoritmo de score (este repositório).
