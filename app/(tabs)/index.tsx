import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { theme } from '../../src/ui/theme';
import { Badge, Btn, Card, Row } from '../../src/ui/components';
import { getState, setState, useAppState } from '../../src/services/store';
import { simulateCall } from '../../src/services/screening';
import { isCallScreeningRoleHeld, isNativeScreeningAvailable } from '../../src/services/nativeBridge';
import { requestNotificationPermission } from '../../src/services/notifications';

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default function Home() {
  const router = useRouter();
  const history = useAppState((s) => s.history);
  const mode = useAppState((s) => s.mode);
  const [simulating, setSimulating] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const today = useMemo(() => {
    const t = history.filter((h) => isToday(h.at));
    return {
      analyzed: t.length,
      blocked: t.filter((h) => h.action === 'BLOCK').length,
      silenced: t.filter((h) => h.action === 'SILENCE').length,
      allowed: t.filter((h) => h.action === 'ALLOW').length,
    };
  }, [history]);

  const active = mode !== 'OFF';
  const [roleHeld, setRoleHeld] = useState<boolean | null>(null);

  async function simulate(number: string) {
    setSimulating(true);
    try {
      if (getState().settings.notifications) {
        await requestNotificationPermission().catch(() => {});
      }
      const decision = await simulateCall(number);
      setLastScore(decision.score);
    } finally {
      setSimulating(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.title}>AntiSpam BR</Text>
        <Badge text={active ? '🟢 PROTEÇÃO ATIVA' : '⚪ DESATIVADA'} color={active ? theme.primary : theme.mute} filled={active} />
      </View>

      <Card>
        <Row label="Modo" value={mode} color={theme.info} />
        <Row label="Hoje" value={`${today.analyzed} analisadas`} />
        <Row label="Permitidas" value={String(today.allowed)} color={theme.primary} />
        <Row label="Silenciadas" value={String(today.silenced)} color={theme.mute} />
        <Row label="Bloqueadas" value={String(today.blocked)} color={theme.danger} />
        <View style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Btn title="📜 Ver histórico" variant="ghost" small onPress={() => router.push('/(tabs)/history')} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn title="❤️ Apoiar projeto" variant="ghost" small onPress={() => router.push('/donate')} />
          </View>
        </View>
      </Card>

      {!isNativeScreeningAvailable() && (
        <Card style={{ borderColor: theme.warn }}>
          <Text style={{ color: theme.warn, fontWeight: '700', marginBottom: 4 }}>⚠️ Modo demonstração</Text>
          <Text style={{ color: theme.textDim, fontSize: 13, lineHeight: 20 }}>
            Você está no Expo Go: todas as telas e o motor de decisão funcionam, mas o Android só entrega chamadas
            reais a um development build (APK/AAB com o módulo nativo). Use o simulador abaixo para ver o app em ação.
          </Text>
        </Card>
      )}
      {isNativeScreeningAvailable() && roleHeld === false && (
        <Card style={{ borderColor: theme.danger }}>
          <Text style={{ color: theme.danger, fontWeight: '700', marginBottom: 4 }}>Proteção nativa não ativada</Text>
          <Text style={{ color: theme.textDim, fontSize: 13 }}>
            Conceda o papel de filtragem de chamadas nas Configurações do app.
          </Text>
        </Card>
      )}

      <Card>
        <Text style={styles.cardTitle}>Simular chamada recebida</Text>
        <Text style={{ color: theme.textDim, fontSize: 13, marginBottom: 10 }}>
          Teste o pipeline completo (normalização → regras → base → score → decisão).
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ width: '48%' }}>
            <Btn title="0303 313 0303" variant="warn" small loading={simulating} onPress={() => simulate('03033130303')} />
          </View>
          <View style={{ width: '48%' }}>
            <Btn title="0800 empresa" variant="warn" small onPress={() => simulate('08001234567')} />
          </View>
          <View style={{ width: '48%' }}>
            <Btn title="Telemarketing +55 11 4002-8922" small variant="warn" onPress={() => simulate('+551140028922')} />
          </View>
          <View style={{ width: '48%' }}>
            <Btn title="Golpe +55 11 98765-4321" small variant="warn" onPress={() => simulate('+5511987654321')} />
          </View>
          <View style={{ width: '48%' }}>
            <Btn title="Fixo SP (11) 3061-4000" small onPress={() => simulate('1130614000')} />
          </View>
          <View style={{ width: '48%' }}>
            <Btn title="🚨 190 (emergência)" small onPress={() => simulate('190')} />
          </View>
        </View>
        {lastScore != null && (
          <Text style={{ color: theme.primary, marginTop: 10, fontWeight: '600' }}>
            Última decisão registrada no histórico (score {lastScore}).
          </Text>
        )}
      </Card>

      <Card onPress={() => router.push('/verify')}>
        <Text style={styles.cardTitle}>🔍 Verificar número</Text>
        <Text style={{ color: theme.textDim, fontSize: 13 }}>
          Consulte score local, explicabilidade e (opcional) análise de IA antes de retornar uma ligação.
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Atalhos</Text>
        <View style={{ gap: 8, marginTop: 6 }}>
          <Btn title="⚙️ Configurações e regras" variant="ghost" small onPress={() => router.push('/(tabs)/settings')} />
          <Btn
            title="🔔 Permissão de notificações"
            variant="ghost"
            small
            onPress={async () => {
              await requestNotificationPermission();
            }}
          />
          <Btn title="🧹 Limpar histórico" variant="ghost" small onPress={() => setState({ history: [] })} />
        </View>
      </Card>

      <Text style={{ color: theme.mute, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
        100% local · sem anúncios · open source{'\n'}Decisões explicáveis e fail-safe: em dúvida, permite.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  title: { color: theme.text, fontSize: 24, fontWeight: '800' },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
});
