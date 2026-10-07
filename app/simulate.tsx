/**
 * Rota de deep link para simular uma chamada recebida:
 *   Expo Go:  exp://<host>/--/simulate?number=%2B551140028922
 *   Dev build: antispambr://simulate?number=%2B551140028922
 *
 * Usada para: testes E2E automatizados, demos e integração com automação.
 * Sem `number`, mostra instruções. Registra a chamada no histórico como simulada.
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '../src/ui/theme';
import { Badge, Btn, Card, Row, ScoreRing } from '../src/ui/components';
import { simulateCall } from '../src/services/screening';
import { parseSimulateParams } from '../src/services/simulateLink';
import type { CallDecision } from '../src/core/types';

export default function Simulate() {
  const params = useLocalSearchParams<{ number?: string }>();
  const router = useRouter();
  const [decision, setDecision] = useState<CallDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Depende do valor primitivo, não do objeto params (instável a cada render —
  // evita loop simular→histórico→render→simular).
  const rawParam = params.number?.trim() ?? '';
  useEffect(() => {
    const raw = rawParam || null;
    if (!raw) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await simulateCall(raw);
        // Log observável via `adb logcat -s ReactNativeJS` (usado no teste E2E).
        console.log('[AntiSpamBR][E2E]', JSON.stringify({
          number: raw,
          canonical: d.normalized.canonical,
          kind: d.normalized.kind,
          action: d.action,
          score: d.score,
          confidence: d.confidence,
          reasons: d.reasons,
        }));
        if (!cancelled) setDecision(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawParam]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <Text style={styles.title}>📡 Simulador via deep link</Text>
      {!params.number && (
        <Card>
          <Text style={{ color: theme.textDim, fontSize: 14, lineHeight: 21 }}>
            Use: <Text style={{ color: theme.info }}>.../simulate?number=+551140028922</Text>{' '}
            (URL-encode o "+": %2B).{'\n\n'}
            A chamada passa pelo pipeline completo (normalização → regras → base → score → decisão)
            e entra no histórico como simulada.
          </Text>
        </Card>
      )}
      {error && (
        <Card style={{ borderColor: theme.danger }}>
          <Text style={{ color: theme.danger }}>Erro: {error}</Text>
        </Card>
      )}
      {decision && (
        <>
          <Card>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <ScoreRing score={decision.score} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
                  {decision.normalized.canonical || 'Número oculto'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Badge
                    text={decision.action}
                    color={
                      decision.action === 'BLOCK' ? theme.danger : decision.action === 'ALLOW' ? theme.primary : theme.warn
                    }
                    filled
                  />
                  <Badge text={`tipo: ${decision.normalized.kind}`} color={theme.info} />
                  <Badge text={decision.confidence} color={theme.mute} />
                </View>
              </View>
            </View>
          </Card>
          <Card>
            <Text style={styles.cardTitle}>Motivos</Text>
            {decision.explanation.map((e, i) => (
              <Text key={i} style={{ color: theme.textDim, fontSize: 13, paddingVertical: 3 }}>• {e}</Text>
            ))}
          </Card>
        </>
      )}
      <Btn title="Voltar ao início" variant="ghost" onPress={() => router.replace('/(tabs)')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  title: { color: theme.text, fontSize: 22, fontWeight: '800' },
  cardTitle: { color: theme.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
});
