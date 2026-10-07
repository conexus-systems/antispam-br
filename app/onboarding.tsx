import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { theme } from '../src/ui/theme';
import { Btn, Card } from '../src/ui/components';
import { setState } from '../src/services/store';
import { isCallScreeningRoleHeld, isNativeScreeningAvailable, requestCallScreeningRole } from '../src/services/nativeBridge';

const STEPS = [
  {
    emoji: '📵',
    title: 'Chega de chamadas indesejadas',
    body: 'Bloqueie telemarketing, golpes e robocalls antes do telefone tocar. 100% local, explicável e gratuito.',
  },
  {
    emoji: '🔒',
    title: 'Seus dados ficam no seu celular',
    body: 'Sem cadastro, sem anúncios, sem envio de contatos ou histórico. A análise de cada chamada acontece no aparelho.',
  },
  {
    emoji: '🛡️',
    title: 'Ative a proteção',
    body: 'O Android pede que o AntiSpam BR seja definido como app de identificação e filtragem de chamadas. É assim que ele consegue proteger você.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [activating, setActivating] = useState(false);
  const s = STEPS[step];

  async function activate() {
    setActivating(true);
    try {
      if (isNativeScreeningAvailable()) {
        const held = await isCallScreeningRoleHeld();
        if (!held) {
          const granted = await requestCallScreeningRole();
          if (!granted) {
            setActivating(false);
            return;
          }
        }
      } else {
        Alert.alert(
          'Modo demonstração',
          Platform.OS === 'ios'
            ? 'No iOS, o bloqueio de chamadas usa Call Directory Extension, configurado na próxima fase nativa. Por enquanto você pode explorar o app com o simulador.'
            : 'Você está no Expo Go (sem módulo nativo). A proteção real será ativada na versão instalada (development build / APK). Explore o simulador!',
        );
      }
      setState({ onboardingDone: true });
      router.replace('/(tabs)');
    } finally {
      setActivating(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 24 }}>
        <Text style={{ fontSize: 72, textAlign: 'center' }}>{s.emoji}</Text>
        <Text style={styles.title}>{s.title}</Text>
        <Card>
          <Text style={styles.body}>{s.body}</Text>
        </Card>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && { backgroundColor: theme.primary, width: 20 }]} />
          ))}
        </View>
      </View>
      <View style={{ gap: 12, paddingBottom: 32 }}>
        {step < STEPS.length - 1 ? (
          <>
            <Btn title="Continuar" onPress={() => { if (theme) Haptics.selectionAsync().catch(() => {}); setStep(step + 1); }} />
            <Btn title="Pular" variant="ghost" onPress={() => router.replace('/(tabs)')} />
          </>
        ) : (
          <>
            <Btn title={activating ? 'Ativando…' : '🛡️ Ativar proteção'} onPress={activate} loading={activating} />
            <Pressable onPress={() => { setState({ onboardingDone: true }); router.replace('/(tabs)'); }}>
              <Text style={{ color: theme.textDim, textAlign: 'center', padding: 8 }}>
                Ativar depois — explorar em modo demonstração
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, padding: 24 },
  title: { color: theme.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  body: { color: theme.textDim, fontSize: 15, lineHeight: 22 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.border },
});
