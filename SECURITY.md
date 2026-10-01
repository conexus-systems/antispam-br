# Security Policy — AntiSpam BR

## Reportar vulnerabilidade

**Não abra issue pública.** Envie para: `security@antispam.br` (placeholder — configure o endereço real antes do release).

Resposta alvo: 72h; fix alvo: 30 dias para críticas.

## Escopo

- Motor de decisão (bypass de bloqueio, fail-safe quebrado).
- Import de backup / deltas (poisoning, RCE via JSON).
- Exposição de dados (contatos, histórico, chaves).
- Ponte nativa (injeção de intent, permissões além do necessário).

## Fora de escopo

- Ataques que exigem device rooted com o atacante já tendo controle total.
- "Ausência" de features hardening (rate limit do backend comunitário entra no M8).

## Práticas adotadas

- Dependências mínimas; `npm audit` no CI.
- Validação estrita de todo input externo (schema + limites).
- Chaves fora do código (env de build / storage do aparelho).
- Fail-safe ALLOW com log local em qualquer exceção.
