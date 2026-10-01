import { useMemo, useState } from 'react';
import { Alert, Clipboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { theme } from '../src/ui/theme';
import { Badge, Btn, Card } from '../src/ui/components';
import { buildPixPayload } from '../src/core/donation/pix';

const AMOUNTS = [5, 10, 20];

export default function Donate() {
  const [amount, setAmount] = useState<number>(10);
  const [custom, setCustom] = useState('');
  const pixKey = process.env.EXPO_PUBLIC_DONATION_PIX_KEY ?? '';

  const value = custom ? Number(custom.replace(',', '.')) : amount;
  const payload = useMemo(() => {
    if (!pixKey || !value || value <= 0) return null;
    try {
      return buildPixPayload({
        key: pixKey,
        merchantName: 'AntiSpam BR',
        merchantCity: 'BRASIL',
        amount: value,
        txid: 'ANTISPAMBR',
      });
    } catch {
      return null;
    }
  }, [pixKey, value]);

  function copy() {
    if (!payload) {
      Alert.alert('Indisponível', 'Configure EXPO_PUBLIC_DONATION_PIX_KEY no build para habilitar doações.');
      return;
    }
    Clipboard.setString(payload);
    Alert.alert('PIX Copia e Cola copiado!', 'Cole no app do seu banco para doar. Obrigado por apoiar! ❤️');
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <Text style={styles.title}>❤️ Apoie o projeto</Text>

      <Card>
        <Text style={{ color: theme.text, fontSize: 14, lineHeight: 22 }}>
          O AntiSpam BR é gratuito, open source, sem anúncios e sem venda de dados. Se ele estiver sendo útil,
          você pode ajudar voluntariamente a manter o desenvolvimento e a base de spam comunitária.
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Badge text="nunca obrigatória" color={theme.primary} />
          <Badge text="não desbloqueia recursos" color={theme.primary} />
          <Badge text="sem versão premium" color={theme.primary} />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Valores sugeridos</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {AMOUNTS.map((v) => (
            <View key={v} style={{ flex: 1 }}>
              <Btn title={`R$ ${v}`} small variant={amount === v && !custom ? 'primary' : 'ghost'} onPress={() => { setAmount(v); setCustom(''); }} />
            </View>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Outro valor (R$)"
          placeholderTextColor={theme.mute}
          keyboardType="decimal-pad"
          value={custom}
          onChangeText={setCustom}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>PIX (Copia e Cola)</Text>
        {pixKey ? (
          <>
            {payload && (
              <View style={{ alignItems: 'center', paddingVertical: 12, backgroundColor: '#fff', borderRadius: 12 }}>
                <QRCode value={payload} size={220} color="#0B1220" backgroundColor="#fff" />
              </View>
            )}
            <View style={{ marginTop: 12 }}>
              <Btn title="📋 Copiar código PIX" onPress={copy} />
            </View>
            {payload && (
              <Text numberOfLines={2} style={{ color: theme.mute, fontSize: 10, marginTop: 8 }}>
                {payload}
              </Text>
            )}
          </>
        ) : (
          <Text style={{ color: theme.textDim, fontSize: 13, lineHeight: 20 }}>
            Doação PIX ainda não configurada neste build.{'\n'}
            Defina a variável <Text style={{ color: theme.info }}>EXPO_PUBLIC_DONATION_PIX_KEY</Text> na sua
            sessão de build (nunca no código-fonte) e esta tela gerará o BR Code automaticamente.
          </Text>
        )}
      </Card>

      <Text style={{ color: theme.mute, fontSize: 12, textAlign: 'center' }}>
        Obrigado por usar um app livre. ❤️
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  title: { color: theme.text, fontSize: 24, fontWeight: '800' },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: theme.cardAlt,
    color: theme.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginTop: 8,
  },
});
