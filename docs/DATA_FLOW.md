# DATA FLOW — AntiSpam BR

## Chamada recebida (nativo)

```
Telecom (Android) → AntiSpamCallScreeningService (Kotlin)
  → bridge (timeout 1,2s)
    → ingestIncomingCall (JS)
      → normalizePhone (puro)
      → decide() (puro; consulta base local + histórico em memória)
      → CallDecision
  → respondToCall(BLOCK/SILENCE/WARN/ALLOW)
  → histórico local + notificação local
```

Nenhuma etapa envolve rede.

## Denúncia

```
Usuário denuncia (histórico) → applyReport (anti-abuse) → base local
Futuro (opt-in): agregação → pacote anônimo → servidor → delta assinado → todos
```

## IA Assistente (opcional, off)

```
Usuário pede análise do número N → POST openrouter.ai (N + score local)
← JSON opinion → exibida como "opinião de IA"
Nunca: contatos, histórico, localização, identidade.
```

## Backup

```
Exportar: estado → JSON validado → clipboard/arquivo local
Importar: JSON → schema estrito + limites → setState
```

## Doação PIX

```
Env de build (EXPO_PUBLIC_DONATION_PIX_KEY) → buildPixPayload (EMV+CRC16 local) → QR/copiar
```
