# ADR 0004 — Privacidade de números: política de publicação + consultas por hash-prefix

## Contexto

O snapshot anterior publicava SHA-256 dos números. Isso **não anonimiza**: o espaço de números
brasileiros válidos é ~10¹¹; um SHA-256 de telefone é revertido por força bruta em minutos numa
GPU comum. Além disso o iOS Call Directory precisa do número cru para bloquear.

Há dois riscos de privacidade distintos:

1. **Quem é o número denunciado** — pode ser uma pessoa física (spoofing, número reciclado,
   assédio direcionado).
2. **O que o usuário consulta** — consultar o servidor revela que o usuário recebeu ligação daquele número.

## Decisão

1. Datasets públicos contêm o número E.164 em claro, **somente** quando passa na política de
   publicação (`docs/specs/PUBLICATION_POLICY.md`): ≥ N denunciantes distintos com peso,
   ≥ 48 h de idade da primeira denúncia, sem contestação pendente, sem quarentena, score ≥ SPAM.
   Números contestados como LEGITIMATE saem no próximo delta.
2. Datasets **não** carregam texto livre, nomes, comentários nem a identidade de denunciantes.
3. Consultas online (portal, app opcional) usam **k-anonimato por prefixo de hash**: o cliente
   envia os 5 primeiros hex do SHA-256 do E.164 (≈ 1 M buckets → milhares de números por
   bucket) e filtra localmente a resposta. O servidor não registra o prefixo consultado com IP.
4. Denúncias guardam o número (necessário para publicar), mas o denunciante é um token de
   dispositivo rotativo, nunca IMEI, conta Google/Apple, IDFA/GAID ou telefone do usuário.
5. Linguagem pública: "denunciado como", "suspeito" — nunca "criminoso"/"golpista".

## Consequências

- Transparência honesta: a documentação não promete anonimato que não existe.
- Base legal LGPD: legítimo interesse (art. 7º IX) para prevenção a fraude, com minimização,
  contestação e retirada — ver `docs/LEGAL_AND_LICENSE_REVIEW.md`.
- O iOS pode montar Call Directory direto do shard.
