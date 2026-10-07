import { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../src/ui/theme';
import { actionColor, actionLabel } from '../../src/ui/theme';
import { Badge, Btn, Card } from '../../src/ui/components';
import { useAppState, getState, toggleList } from '../../src/services/store';
import { reportHistoryEntry } from '../../src/services/screening';
import { REPORT_CATEGORY_LABELS, type HistoryEntry, type ReportCategory } from '../../src/core/types';

const CATEGORIES = Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[];

export default function History() {
  const history = useAppState((s) => s.history);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reporting, setReporting] = useState<HistoryEntry | null>(null);

  const stats = useMemo(() => {
    const blocked = history.filter((h) => h.action === 'BLOCK').length;
    const savedMin = Math.round(blocked * 0.75);
    return { blocked, savedMin };
  }, [history]);

  async function chooseCategory(cat: ReportCategory) {
    if (!reporting) return;
    await reportHistoryEntry(reporting.id, cat);
    setReporting(null);
    Alert.alert('Obrigado!', 'Denúncia registrada localmente. Ela fortalece sua base e, quando a base comunitária estiver ativa, ajudará todos.');
  }

  function quickAction(entry: HistoryEntry, kind: 'allow' | 'block') {
    if (!entry.number) return;
    toggleList(kind === 'allow' ? 'allowlist' : 'blacklist', entry.number);
    Alert.alert(
      kind === 'allow' ? 'Sempre permitir' : 'Bloqueado',
      `${entry.display} ${kind === 'allow' ? 'adicionado à allowlist' : 'adicionado à blacklist'}.`,
    );
  }

  return (
    <View style={styles.root}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Text style={styles.title}>Histórico</Text>
        <Text style={{ color: theme.textDim, fontSize: 13 }}>
          {history.length} chamadas · {stats.blocked} bloqueadas · ⏱️ ~{stats.savedMin} min poupados (estimativa)
        </Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10, paddingBottom: 40 }}
        ListEmptyComponent={
          <Card>
            <Text style={{ color: theme.textDim, textAlign: 'center', paddingVertical: 20 }}>
              Nenhuma chamada ainda.{'\n'}Use o simulador na aba Início para ver o app funcionando.
            </Text>
          </Card>
        }
        renderItem={({ item }) => {
          const open = openId === item.id;
          return (
            <Card>
              <Pressable onPress={() => setOpenId(open ? null : item.id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
                      {item.name || item.display || 'Número oculto'}
                    </Text>
                    <Text style={{ color: theme.textDim, fontSize: 12 }}>
                      {new Date(item.at).toLocaleString('pt-BR')} · score {item.score}
                    </Text>
                  </View>
                  <Badge text={actionLabel(item.action)} color={actionColor(item.action)} filled />
                </View>
              </Pressable>

              {open && (
                <View style={{ marginTop: 10, gap: 8 }}>
                  <Text style={{ color: theme.textDim, fontSize: 13 }}>Motivos (decisão explicável):</Text>
                  {item.reasons.length === 0 && <Text style={{ color: theme.mute, fontSize: 13 }}>• Nenhum sinal relevante.</Text>}
                  {item.reasons.map((r) => (
                    <Text key={r} style={{ color: theme.text, fontSize: 13 }}>• {r}</Text>
                  ))}
                  {item.simulated && <Badge text="simulada" color={theme.info} />}
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <Btn title="🚩 Denunciar" variant="danger" small onPress={() => setReporting(item)} />
                    <Btn title="✅ Sempre permitir" small onPress={() => quickAction(item, 'allow')} />
                    <Btn title="🚫 Bloquear nº" variant="danger" small onPress={() => quickAction(item, 'block')} />
                  </View>
                </View>
              )}
            </Card>
          );
        }}
      />

      <Modal visible={!!reporting} transparent animationType="slide" onRequestClose={() => setReporting(null)}>
        <View style={styles.modalBackdrop}>
          <Card style={{ width: '92%', maxHeight: '80%' }}>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 17, marginBottom: 4 }}>
              Denunciar {reporting?.display}
            </Text>
            <Text style={{ color: theme.textDim, fontSize: 13, marginBottom: 12 }}>
              Obrigado por ajudar! A denúncia é processada localmente (anti-abuse: denunciantes únicos, recência e falso-positivos).
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map((cat) => (
                <Btn key={cat} title={REPORT_CATEGORY_LABELS[cat]} variant="ghost" small onPress={() => chooseCategory(cat)} />
              ))}
            </View>
            <View style={{ marginTop: 12 }}>
              <Btn title="Cancelar" variant="ghost" small onPress={() => setReporting(null)} />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  title: { color: theme.text, fontSize: 24, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
});
