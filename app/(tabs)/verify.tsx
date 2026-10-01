import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../src/ui/theme';
import { Badge, Btn, Card, Row, ScoreRing } from '../../src/ui/components';
import { useAppState, toggleList } from '../../src/app/store';
import { getDb, ensureDb } from '../../src/app/screening';
import { normalizePhone, formatDisplay } from '../../src/core/phone/normalize';
import { computeSpamScore, riskBand } from '../../src/core/detection/spamScore';
import { analyzeNumber, type AiInsight } from '../../src/core/ai/openrouter';

export default function Verify() {
  const ai = useAppState((s) => s.ai);
  const [number, setNumber] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<null | {
    display: string;
    canonical: string;
    kind: string;
    ddd?: string;
    score: number;
    confidence: string;
    band: string;
    contributions: Array<{ label: string; points: number }>;
    repReports: number;
  }>(null);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function analyze() {
    if (!number.trim()) return;
    setAnalyzing(true);
    setAiInsight(null);
    setAiError(null);
    try {
      await ensureDb();
      const n = normalizePhone(number.trim());
      const rep = getDb().get(n.canonical);
      const breakdown = computeSpamScore({
        phone: n,
        reputation: rep ? { score: rep.score, reports: rep.reports, confidence: rep.confidence } : null,
      });
      setResult({
        display: formatDisplay(n.canonical),
        canonical: n.canonical || '—',
        kind: n.kind,
        ddd: n.ddd,
        score: breakdown.score,
        confidence: breakdown.confidence,
        band: riskBand(breakdown.score),
        contributions: breakdown.contributions,
        repReports: rep?.reports ?? 0,
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function askAi() {
    if (!result) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const insight = await analyzeNumber(
        { apiKey: ai.apiKey, model: ai.model || undefined },
        {
          number: result.canonical,
          kind: result.kind,
          ddd: result.ddd,
          localScore: result.score,
          localReasons: result.contributions.map((c) => c.label),
        },
      );
      setAiInsight(insight);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Falha na análise de IA');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Text style={styles.title}>🔍 Verificar número</Text>
        <Card>
          <TextInput
            value={number}
            onChangeText={setNumber}
            placeholder="(11) 99999-9999 ou +5511…"
            placeholderTextColor={theme.mute}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <Btn title="Analisar" onPress={analyze} loading={analyzing} />
          <Text style={{ color: theme.mute, fontSize: 12, marginTop: 8 }}>
            A análise local nunca envia o número para a Internet.
          </Text>
        </Card>

        {result && (
          <>
            <Card>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <ScoreRing score={result.score} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>{result.display}</Text>
                  <Text style={{ color: theme.textDim, fontSize: 13 }}>Canônico: {result.canonical}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Badge text={result.band} color={result.score >= 61 ? theme.danger : result.score >= 41 ? theme.warn : theme.primary} filled />
                    <Badge text={`tipo: ${result.kind}`} color={theme.info} />
                    {result.ddd && <Badge text={`DDD ${result.ddd}`} color={theme.info} />}
                  </View>
                </View>
              </View>
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Por que este score?</Text>
              {result.contributions.length === 0 && (
                <Text style={{ color: theme.mute, fontSize: 13 }}>Nenhum sinal de risco encontrado nesta base local.</Text>
              )}
              {result.contributions.map((c, i) => (
                <Row key={i} label={c.label} value={`+${c.points}`} color={theme.warn} />
              ))}
              <Row label="Confiança" value={result.confidence} />
              {result.repReports > 0 && <Row label="Denúncias na sua base" value={String(result.repReports)} />}
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Ações rápidas</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Btn title="✅ Sempre permitir" small onPress={() => toggleList('allowlist', result.canonical)} />
                <Btn title="🚫 Bloquear sempre" variant="danger" small onPress={() => toggleList('blacklist', result.canonical)} />
              </View>
            </Card>

            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={styles.cardTitle}>✨ Análise de IA (opcional)</Text>
                <Badge text={ai.enabled ? 'ativada' : 'desativada'} color={ai.enabled ? theme.primary : theme.mute} />
              </View>
              {!ai.enabled && (
                <Text style={{ color: theme.textDim, fontSize: 13 }}>
                  Ative a IA Assistente em Ajustes para pedir uma segunda opinião a um modelo via OpenRouter
                  (você fornece a própria chave; ela fica só no aparelho). A IA NUNCA decide bloqueios.
                </Text>
              )}
              {ai.enabled && !aiInsight && (
                <Btn title="Pedir análise à IA" variant="ghost" onPress={askAi} loading={aiLoading} />
              )}
              {aiError && <Text style={{ color: theme.danger, fontSize: 13, marginTop: 6 }}>{aiError}</Text>}
              {aiInsight && (
                <View style={{ gap: 6, marginTop: 4 }}>
                  <Badge text={`IA: ${aiInsight.riskLevel}`} color={aiInsight.riskLevel === 'alto' ? theme.danger : aiInsight.riskLevel === 'médio' ? theme.warn : theme.primary} filled />
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{aiInsight.verdict}</Text>
                  {aiInsight.reasoning.map((r, i) => (
                    <Text key={`r${i}`} style={{ color: theme.textDim, fontSize: 13 }}>• {r}</Text>
                  ))}
                  {aiInsight.advice.map((a, i) => (
                    <Text key={`a${i}`} style={{ color: theme.info, fontSize: 13 }}>→ {a}</Text>
                  ))}
                  <Text style={{ color: theme.mute, fontSize: 11, marginTop: 4 }}>
                    Opinião gerada por IA — use como apoio, não como verdade.
                  </Text>
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.text, fontSize: 24, fontWeight: '800' },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: theme.cardAlt,
    color: theme.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 10,
  },
});
