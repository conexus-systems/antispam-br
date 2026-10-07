# SMS SCAM ENGINE — AntiSpam BR (M4)

> Análise **100% local** de mensagens. O texto completo nunca sai do dispositivo —
> apenas um hash SHA-256 do texto normalizado, e somente com telemetria opt-in.

## 1. Pipeline

```
SMS (sender + body)
      ↓
normalization (NFKC, lowercase p/ casamento)
      ↓
URL extraction + análise (urlExtractor.ts)
      ↓
text heuristics (heuristics.ts)
      ↓
sender reputation (OTP legítimo / short code)
      ↓
combos de smishing (encurtador+pressão, PIX+urgência)
      ↓
risk score 0–100 (saturado, determinístico)
      ↓
SAFE (< 25) · SUSPECT (25–54) · SCAM (≥ 55 ou evidência forte de URL)
```

## 2. Sinais de URL (`urlExtractor.ts`)

| Sinal | Pontos | Exemplo |
|---|---|---|
| Encurtador | +15 | `bit.ly/abc`, `cutt.ly/x` |
| Host IP | +30 (forte) | `http://193.22.11.4/pag` |
| HTTP inseguro | +10 | `http://...` |
| TLD abusado | +20 | `.xyz`, `.tk`, `.top` |
| Impersonação de marca | +30 (forte) | `nubank-promocoes.xyz` |
| Punycode/IDN | +25 (forte) | `xn--nubank-fqb.com` |
| Homoglifos Unicode | +25 (forte) | `nub\u0430nk.com` (а cirílico) |

**Impersonação**: a marca precisa estar no domínio *registrável* para ser oficial
(`conta.itau.com.br` ✅ oficial; `itau-seguranca.com` ❌ impersonação).
Mapa de domínios oficiais por marca em `BRAND_OFFICIAL_HOSTS`.

## 3. Heurísticas de texto (`heuristics.ts`)

| Sinal | Pontos | Categoria |
|---|---|---|
| Chave PIX (CPF/UUID) | +30 | PIX_SCAM |
| Código de boleto (47 dígitos) | +25 | PHISHING |
| Banco + (senha ou urgência) | +30 | BANK_SCAM |
| Entrega + (taxa ou urgência) | +25 | DELIVERY_SCAM |
| Suporte + urgência | +20 | FAKE_SUPPORT |
| Urgência isolada | +15 | — |
| Pedido de senha/dados | +25 | — |
| Pedido de código OTP | +25 | — |
| Coleta de CPF | +15 | — |
| Marketing/telemarketing | +15 | — |
| Pressão financeira isolada | +12 | — |

**Mitigação**: OTP de remetente conhecido (WhatsApp, Google, bancos...) → −15
(reduz, não zera: phishing pode fingir o remetente).

## 4. Combos (padrões reais de smishing BR)

- **Encurtador + pressão** (prêmio/multa/taxa) → +20
- **PIX + urgência** → +20
- **Short code numérico + marketing** → +10

## 5. Thresholds (configuráveis — `SMS_THRESHOLDS`)

```ts
SUSPECT_AT: 25,   // >= vira SUSPECT
SCAM_AT: 55,      // >= vira SCAM
LEGIT_OTP_BONUS: -15,
HARD_URL_EVIDENCE: 40,   // URL forte (IP/punycode/homoglifo) + score >= 40 → SCAM
SHORTENER_PLUS_PRESSURE: 20,
```

## 6. Privacidade

- Texto e remetente processados apenas em memória, no dispositivo.
- `bodyHash = sha256(texto normalizado)` — permite agregação anônima futura sem reidentificação.
- Nenhuma chamada de rede no pipeline.

## 7. Corpus anonimizado (`data/sms-corpus/anonymous-corpus.json`)

14 casos sintéticos (CC0-1.0, nenhum texto real) cobrindo os 7 tipos exigidos:
spam, telemarketing, golpe (PIX/banco/entrega/OTP/homoglifo), mensagem legítima,
banco legítimo, entrega legítima, OTP legítimo.
Cada caso é um teste: o corpus **tem que** bater com o verdict esperado no CI.

## 8. Ingestion por plataforma (próximo passo)

| Plataforma | Caminho |
|---|---|
| Android ≤ 8 | `SMS_RECEIVED` receiver real (fora do Play — política) |
| Android 9+ | Análise de SMS encaminhado/compartilhado manualmente pelo usuário |
| iOS | Portar heurísticas para ILMessageFilterExtension (Swift) |
