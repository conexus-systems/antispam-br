# Política de publicação de números

Um número só entra no dataset público `br-calls` quando **todas** as condições valem:

| Condição | Valor padrão | Motivo |
|---|---|---|
| Denunciantes distintos ponderados (Σw) | ≥ 3 | uma denúncia (ou duas) nunca publica |
| Idade da primeira denúncia válida | ≥ 48 h | impede "bombardeio" instantâneo |
| Score | ≥ 60 (SPAM) | só publica o que é acionável |
| Quarentena de surto | inativa | ADR 0006 §6 |
| Contestação LEGITIMATE pendente | nenhuma | contestação suspende publicação até moderação |
| Número de utilidade pública/emergência | nunca | `never_block` em `brazil-numbering.json` |
| Organização verificada (`VERIFIED_ORG`) | publica só com flag, cliente limita a WARN | bancos legítimos ligam de centrais compartilhadas |

Saída do dataset (tombstone no próximo delta):

- contestação aceita pela moderação;
- score cai abaixo de 40 por decaimento (meia-vida 30 dias);
- pedido do titular comprovado (LGPD art. 18) — processado em até 15 dias.

Nada no dataset identifica denunciantes, contém comentários livres ou nomes.
Comentários (opcionais) ficam no servidor, moderados, e nunca são publicados com PII.
