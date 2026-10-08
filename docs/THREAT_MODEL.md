# THREAT MODEL — AntiSpam BR

Método: STRIDE por ativo + abuso específico de comunidades. Revisado em 2026-10-07 (M0/M1).

## 1. Ativos

| Ativo | Por que importa |
|---|---|
| Decisão de bloqueio no aparelho | Falso positivo = pessoa perde ligação importante (médico, banco real, família) |
| Dataset publicado | Envenenado, bloqueia inocentes em massa; congelado, para de proteger |
| Chave de assinatura Ed25519 | Comprometida = atacante publica qualquer dataset |
| Denúncias e reputação de denunciantes | Alvo de Sybil/assédio; metadados podem revelar quem recebeu ligação de quem |
| Dados locais (histórico, listas, denúncias) | Dados pessoais do usuário |
| Números denunciados | Podem ser de pessoas físicas (LGPD), inclusive vítimas de spoofing |

## 2. Atacantes

1. **Spammer/golpista** — quer tirar o próprio número da base ou evitar detecção (rotação de números, spoofing).
2. **Assediador** — quer marcar o número de uma pessoa específica como golpe.
3. **Concorrente desleal** — quer sujar números de outra empresa.
4. **Operador de botnet** — Sybil, flood de denúncias, replay, exaustão da API.
5. **Atacante de rede / CDN comprometida** — troca ou congela datasets.
6. **App malicioso no aparelho** — tenta ler/alterar dados do AntiSpam BR.
7. **Insider / servidor comprometido** — acesso ao banco de denúncias.

## 3. Ameaças e mitigações

| # | Ameaça | Mitigação | Status |
|---|---|---|---|
| T1 | Dataset adulterado em trânsito/CDN | Ed25519 sobre bytes do manifest + sha256/size por arquivo; HTTPS; path allowlist | ✅ M1 (testado com vetores adulterados) |
| T2 | Rollback para dataset antigo | `version` monotônica, cliente recusa `<=` | ✅ M1 |
| T3 | Freeze (servidor para de atualizar) | `expires_at`; UI avisa base vencida | ✅ verificação · 🔜 aviso na UI |
| T4 | Chave de assinatura vazada | Chave offline fora da API; 2 chaves embarcadas para rotação; `test-*` recusada em release | ✅ código · 🔜 cerimônia de chaves (M3) |
| T5 | Gzip bomb / arquivo gigante | Tamanho esperado do manifest; teto de descompressão = 32 + 16·N | ✅ M1 |
| T6 | Falso positivo por heurística | BLOCK exige evidência forte; heurística ≤ SILENCE; emergência/1XX nunca bloqueados; contatos não chegam à triagem | ✅ M1 (vetores) |
| T7 | Falha/lentidão do app durante a chamada | Fail-open ALLOW; orçamento 1,5 s + cão de guarda em 1,8 s (prazo do sistema 5 s); decisão em thread própria; snapshot em memória | ✅ M1 |
| T7b | Emergência formatada de outro jeito (`+190`, `0190`, `+55 190`) escapando da proteção | Detecção de emergência antes de qualquer outra normalização; vetores com regra `.*` e prefixos | ✅ M1 |
| T8 | Sybil / mass reporting | Peso por denunciante, Σw ≥ 3, idade mínima de 48 h, teto de peso por rede (/24, /32 v6), ≥ 3 redes e ≥ 50 % de peso maduro para publicar, PoW de uso único no registro, rate limit por dispositivo e rede, outlier p99 | ✅ M2 (vetores + testes de API) |
| T9 | Assédio direcionado (marcar pessoa) | Uma denúncia nunca publica; quarentena de surto; contestação madura suspende publicação; resposta pública neutra até publicar; sem denúncias individuais nem autores na API | ✅ M2 |
| T10 | Spammer limpando o próprio número | Contestações ponderadas e com teto por rede; contestação de dispositivo < 30 dias só soma até o peso das antigas; suspensão exige contestante ≥ 30 dias; fila ordenada por peso | ✅ M2 · risco residual: tokens envelhecidos ≥ 30 dias |
| T11 | Replay de denúncias | nonce único por dispositivo + janela de ±10 min; desafio PoW de uso único | ✅ M2 |
| T12 | Spoofing de número legítimo (golpe usando número de banco) | Flag `VERIFIED_ORG` limita ação a WARN; STIR/SHAKEN falho soma pontos; Origem Verificada (Anatel) como sinal | ✅ engine · 🔜 curadoria de orgs |
| T13 | Desanonimização por hash de telefone | Admitido: hash não protege número (10¹¹ combinações). Datasets só com números que passam a política; consultas por hash-prefix (k-anonimato) | ✅ ADR 0004 |
| T14 | Servidor aprende quem recebeu ligação de quem | App não consulta servidor durante chamada; consulta opcional por prefixo de 5 hex; sem log de IP+prefixo | ✅ M1 (sem consulta) · ✅ M2 (hash-prefix sem log de IP) |
| T15 | Vazamento de dados locais por backup | `allowBackup=false`, `dataExtractionRules` excluem tudo, dados em `noBackupFilesDir` | ✅ M1 |
| T16 | ReDoS em regra regex do usuário | Padrão ≤ 128 caracteres, entradas ≤ ~20 caracteres, regex inválida recusada | ✅ M1 |
| T17 | SQL injection / mass assignment na API | Queries parametrizadas, validação estrita de campos, payload ≤ 16 kB, CSP sem inline no portal | ✅ M2 |
| T18 | Abuso da API como oráculo (enumerar reputação) | Hash-prefix só devolve números publicados; consulta direta é neutra até publicar; rate limit por rede; refs de denúncia HMAC não enumeráveis | ✅ M2 |
| T19 | Dependência maliciosa / licença incompatível | License scan, SBOM, dependency review no CI; deps mínimas (BouncyCastle, kotlinx) | ✅ CI |

## 4. Riscos residuais aceitos

- Números de golpe rotativos (descartáveis) escapam do dataset; heurísticas e campanhas mitigam parcialmente.
- iOS não permite decisão por chamada; cobertura iOS depende do tamanho da Call Directory e do Live Caller ID.
- Um dataset legítimo pode conter número reciclado até o decaimento/contestação removê-lo.
