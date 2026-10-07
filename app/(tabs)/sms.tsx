import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme, scoreColor } from '../../src/ui/theme';
import { Btn, Card } from '../../src/ui/components';
import { analyzeSms, SMS_THRESHOLDS } from '../../src/core/sms/smsEngine';
import type { SmsVerdict } from '../../src/core/sms/types';

const VERDICT_STYLE: Record<SmsVerdict, { label: string; color: string; emoji: string }> = {
  SAFE: { label: 'Segura', color: theme.primary, emoji: '✅' },
  SUSPECT: { label: 'Suspeita', color: theme.warn, emoji: '⚠️' },
  SCAM: { label: 'Golpe provável', color: theme.danger, emoji: '🚨' },
};

/**
 * Tela de análise de SMS (M4) — reutiliza o motor local `analyzeSms`.
 * PRIVACIDADE: nada é enviado a servidor algum; análise 100% on-device.
 * Fluxo sugerido ao usuário (Android 9+): encaminhar/copiar a mensagem suspeita aqui.
 */
export default function Sms() {
  const [sender, setSender] = useState('');
  const [body, setBody] = useState('');
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeSms> | null>(null);

  function analyze() {
    if (!body.trim()) return;
    setAnalysis(analyzeSms({ sender: sender.trim() || null, body }));
  }

  function clear() {
    setSender('');
    setBody('');
    setAnalysis(null);
  }

  const vs = analysis ? VERDICT_STYLE[analysis.verdict] : null;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Análise de SMS</Text>
        <Text style={styles.subtitle}>
          Cole a mensagem suspeita. A análise é local — o texto {`não`} sai do seu aparelho.
        </Text>

        <Card style={styles.card}>
          <Text style={styles.label}>Remetente (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex.: Nubank, Correios, 30300 — ou vazio"
            placeholderTextColor={theme.textDim}
            value={sender}
            onChangeText={setSender}
            maxLength={40}
          />
          <Text style={styles.label}>Mensagem</Text>
          <TextInput
            style={[styles.input, styles.bodyInput]}
            placeholder="Cole aqui o texto do SMS..."
            placeholderTextColor={theme.textDim}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1000}
          />
          <View style={styles.actionsRow}>
            <Btn title="Analisar" onPress={analyze} disabled={!body.trim()} small />
            <Btn title="Limpar" onPress={clear} variant="ghost" small />
          </View>
        </Card>

        {analysis && vs && (
          <Card style={styles.resultCard}>
            <View style={[styles.verdictPill, { borderColor: vs.color }]}>
              <Text style={[styles.verdictText, { color: vs.color }]}>
                {vs.emoji} {vs.label}
              </Text>
            </View>

            <Text style={styles.scoreLine}>
              Score de risco: <Text style={{ color: scoreColor(analysis.score), fontWeight: '700' }}>{analysis.score}/100</Text>
              {'  '}· confiança {analysis.confidence}
            </Text>

            {analysis.urls.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Links encontrados ({analysis.urls.length})</Text>
                {analysis.urls.map((u, i) => (
                  <Text key={i} style={styles.urlItem}>
                    • {u.host}
                    {u.isShortener ? ' (encurtador)' : ''}
                    {u.isIpHost ? ' (IP direto)' : ''}
                    {u.isHttp ? ' (sem https)' : ''}
                    {u.isPunycode ? ' (punycode)' : ''}
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sinais detectados</Text>
              {analysis.explanation.length === 0 ? (
                <Text style={styles.itemNenhum}>Nenhum sinal de risco — mensagem parece legítima.</Text>
              ) : (
                analysis.explanation.map((e, i) => (
                  <Text key={i} style={styles.explanationItem}>
                    • {e}
                  </Text>
                ))
              )}
            </View>

            <Text style={styles.privacyNote}>
              🔒 Hash local do texto: {analysis.bodyHash.slice(0, 12)}… (nada foi enviado)
            </Text>
          </Card>
        )}

        <Card style={styles.thresholdCard}>
          <Text style={styles.thresholdTitle}>Critérios (o motor é auditável)</Text>
          <Text style={styles.thresholdItem}>• Segura: score &lt; {SMS_THRESHOLDS.SUSPECT_AT}</Text>
          <Text style={styles.thresholdItem}>• Suspeita: {SMS_THRESHOLDS.SUSPECT_AT}–{SMS_THRESHOLDS.SCAM_AT - 1}</Text>
          <Text style={styles.thresholdItem}>• Golpe: ≥ {SMS_THRESHOLDS.SCAM_AT} ou link com evidência forte (IP/punycode)</Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  container: { padding: 16, paddingBottom: 40, gap: 12 },
  title: { color: theme.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: theme.textDim, fontSize: 13, lineHeight: 18 },
  card: { gap: 8 },
  actionsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  resultCard: { gap: 10 },
  thresholdCard: { gap: 6 },
  label: { color: theme.textDim, fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: theme.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  bodyInput: { minHeight: 110, textAlignVertical: 'top' },
  verdictPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  verdictText: { fontSize: 16, fontWeight: '800' },
  scoreLine: { color: theme.textDim, fontSize: 13 },
  section: { gap: 4 },
  sectionTitle: { color: theme.text, fontSize: 13, fontWeight: '700' },
  urlItem: { color: theme.textDim, fontSize: 12, fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: undefined }) },
  explanationItem: { color: theme.text, fontSize: 12, lineHeight: 17 },
  itemNenhum: { color: theme.textDim, fontSize: 12 },
  privacyNote: { color: theme.textDim, fontSize: 11 },
  thresholdTitle: { color: theme.text, fontSize: 13, fontWeight: '700' },
  thresholdItem: { color: theme.textDim, fontSize: 12 },
});
