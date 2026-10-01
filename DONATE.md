# ❤️ Donate — AntiSpam BR

O AntiSpam BR é **100% gratuito, open source, sem anúncios e sem venda de dados**.

Doações são **sempre opcionais** e **nunca desbloqueiam recursos** — não existe versão premium, não existe popup insistente, e quem não doa tem exatamente a mesma experiência.

## Por que doar (se quiser)

- Manutenção do desenvolvimento (tempo de engenharia).
- Infraestrutura da base comunitária (futura: servidor de deltas assinados).
- Conta de desenvolvedor para distribuição (Google Play / Apple).

## Como doar via PIX

O app tem uma tela **"Apoie o projeto"** que gera o **PIX Copia e Cola** (BR Code EMV, padrão Banco Central) no próprio aparelho.

A chave PIX vem da variável de build — **nunca no código-fonte**:

```bash
EXPO_PUBLIC_DONATION_PIX_KEY=sua-chave npx expo export
# ou no eas.json (build production)
```

Valores sugeridos: R$ 5 · R$ 10 · R$ 20 · outro. Doar não cria obrigação nem expectativa — obrigado só por usar. 🛡️
