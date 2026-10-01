import { useState } from 'react';
import { Alert, Clipboard, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/ui/theme';
import { Badge, Btn, Card, Row } from '../../src/ui/components';
import {
  useAppState,
  setMode,
  setCustomConfig,
  upsertRule,
  removeRule,
  toggleList,
  getState,
  setState,
} from '../../src/app/store';
import { importBackup, exportBackup } from '../../src/app/backup';
import { getDb } from '../../src/app/screening';
import { isCallScreeningRoleHeld, isNativeScreeningAvailable, openCallScreeningSettings, requestCallScreeningRole } from '../../src/app/nativeBridge';
import { HANDLE_0303_LABELS, type Handle0303 } from '../../src/core/phone/brazilRules';
import type { ProtectionMode } from '../../src/core/types';

const MODES: Array<{ id: ProtectionMode; label: string; desc: string }> = [
  { id: 'OFF', label: '⚪ Desativado', desc: 'Não analisa nem bloqueia nada.' },
  { id: 'BASIC', label: '🟢 Básico', desc: 'Bloqueia só spam de altíssima confiança.' },
  { id: 'BALANCED', label: '🔵 Equilibrado', desc: 'Bloqueia spam conhecido e campanhas suspeitas. Recomendado.' },
  { id: 'AGGRESSIVE', label: '🟠 Agressivo', desc: 'Mais restritivo. Maior risco de bloquear algo legítimo.' },
  { id: 'CUSTOM', label: '🎛️ Personalizado', desc: 'Você define limiares e o tratamento do 0303.' },
];

export default function Settings() {
  const router = useRouter();
  const mode = useAppState((s) => s.mode);
  const config = useAppState((s) => s.config);
  const rules = useAppState((s) => s.rules);
  const allowlist = useAppState((s) => s.allowlist);
  const blacklist = useAppState((s) => s.blacklist);
  const ai = useAppState((s) => s.ai);
  const history = useAppState((s) => s.history);

  const [newRule, setNewRule] = useState({ name: '', prefix: '' });
  const [listInput, setListInput] = useState({ allow: '', block: '' });
  const [aiKeyInput, setAiKeyInput] = useState(ai.apiKey);
  const [roleHeld, setRoleHeld] = useState<boolean | null>(null);

  async function refreshRole() {
    if (isNativeScreeningAvailable()) setRoleHeld(await isCallScreeningRoleHeld());
  }
  void refreshRole();

  function addPrefixRule() {
    const name = newRule.name.trim() || `Prefixo ${newRule.prefix}`;
    if (!newRule.prefix.trim()) return;
    upsertRule({
      id: `rule-${Date.now().toString(36)}`,
      name,
      enabled: true,
      action: 'BLOCK',
      match: { kind: 'prefix', value: newRule.prefix.replace(/\s+/g, '') },
    });
    setNewRule({ name: '', prefix: '' });
  }

  function addToList(kind: 'allow' | 'block') {
    const value = (kind === 'allow' ? listInput.allow : listInput.block).trim();
    if (!value) return;
    toggleList(kind === 'allow' ? 'allowlist' : 'blacklist', value);
    setListInput((p) => ({ ...p, [kind]: '' }));
  }

  async function doExport() {
    const json = await exportBackup();
    Clipboard.setString(json);
    Alert.alert('Backup gerado', 'JSON copiado para a área de transferência. Cole num arquivo seguro.');
  }

  async function doImport() {
    try {
      const json = await Clipboard.getString();
      const res = await importBackup(json);
      Alert.alert(res.ok ? 'Importado' : 'Erro', res.ok ? 'Backup restaurado com validação de schema.' : res.error ?? 'Erro desconhecido');
    } catch {
      Alert.alert('Erro', 'Não consegui ler a área de transferência.');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <Text style={styles.title}>⚙️ Ajustes</Text>

      <Card>
        <Text style={styles.cardTitle}>🛡️ Proteção</Text>
        {isNativeScreeningAvailable() && (
          <View style={{ marginBottom: 10, gap: 8 }}>
            <Row label="Papel de filtragem de chamadas" value={roleHeld ? 'Ativo' : 'Inativo'} color={roleHeld ? theme.primary : theme.danger} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn title="Conceder papel" small onPress={async () => { await requestCallScreeningRole(); await refreshRole(); }} />
              <Btn title="Abrir configurações" variant="ghost" small onPress={() => openCallScreeningSettings()} />
            </View>
          </View>
        )}
        {MODES.map((m) => (
          <Card
            key={m.id}
            onPress={() => setMode(m.id)}
            style={{ marginBottom: 8, borderColor: mode === m.id ? theme.primary : theme.border, backgroundColor: mode === m.id ? theme.cardAlt : theme.card }}
          >
            <Text style={{ color: theme.text, fontWeight: '700' }}>{m.label}</Text>
            <Text style={{ color: theme.textDim, fontSize: 13 }}>{m.desc}</Text>
          </Card>
        ))}
        {mode === 'CUSTOM' && (
          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={{ color: theme.textDim, fontSize: 13 }}>Bloquear a partir do score:</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[60, 70, 75, 85, 90].map((v) => (
                <Btn key={v} title={String(v)} small variant={config.blockThreshold === v ? 'primary' : 'ghost'} onPress={() => setCustomConfig({ blockThreshold: v })} />
              ))}
            </View>
            <Text style={{ color: theme.textDim, fontSize: 13, marginTop: 6 }}>Chamadas 0303 (telemarketing):</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(Object.keys(HANDLE_0303_LABELS) as Handle0303[]).map((k) => (
                <Btn key={k} title={HANDLE_0303_LABELS[k]} small variant={config.handle0303 === k ? 'primary' : 'ghost'} onPress={() => setCustomConfig({ handle0303: k })} />
              ))}
            </View>
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>📏 Regras ({rules.length})</Text>
        {rules.map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{r.name}</Text>
              <Text style={{ color: theme.textDim, fontSize: 12 }}>
                {r.match.kind}: {('value' in r.match && r.match.value) || ('pattern' in r.match && r.match.pattern) || ''} · ação {r.action}
              </Text>
            </View>
            <Switch value={r.enabled} onValueChange={(v) => upsertRule({ ...r, enabled: v })} trackColor={{ true: theme.primary }} />
            <Btn title="✕" variant="ghost" small onPress={() => removeRule(r.id)} />
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Nome da regra" placeholderTextColor={theme.mute} value={newRule.name} onChangeText={(v) => setNewRule((p) => ({ ...p, name: v }))} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="+55114002…" placeholderTextColor={theme.mute} value={newRule.prefix} onChangeText={(v) => setNewRule((p) => ({ ...p, prefix: v }))} keyboardType="phone-pad" />
        </View>
        <Btn title="➕ Adicionar regra de prefixo (bloquear)" onPress={addPrefixRule} style={{ marginTop: 8 }} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>✅ Permitidos ({allowlist.length})</Text>
        {allowlist.map((v) => (
          <Row key={v} label={v} value="remover" color={theme.danger} />
        ))}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="+5511999999999" placeholderTextColor={theme.mute} value={listInput.allow} onChangeText={(v) => setListInput((p) => ({ ...p, allow: v }))} keyboardType="phone-pad" />
          <Btn title="Adicionar" small onPress={() => addToList('allow')} />
        </View>
        <Text style={styles.cardTitle}>🚫 Bloqueados ({blacklist.length})</Text>
        {blacklist.map((v) => (
          <Row key={v} label={v} value="remover" color={theme.danger} />
        ))}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="+5511999999999" placeholderTextColor={theme.mute} value={listInput.block} onChangeText={(v) => setListInput((p) => ({ ...p, block: v }))} keyboardType="phone-pad" />
          <Btn title="Adicionar" small onPress={() => addToList('block')} />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>✨ IA Assistente (OpenRouter)</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.textDim, fontSize: 13 }}>Off por padrão · nunca decide bloqueios</Text>
          <Switch value={ai.enabled} onValueChange={(v) => setState({ ai: { ...ai, enabled: v } })} trackColor={{ true: theme.primary }} />
        </View>
        {ai.enabled && (
          <>
            <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="sk-or-v1-…" placeholderTextColor={theme.mute} value={aiKeyInput} onChangeText={setAiKeyInput} autoCapitalize="none" secureTextEntry />
            <TextInput style={styles.input} placeholder="Modelo (opcional, ex.: deepseek/deepseek-chat-v3.1:free)" placeholderTextColor={theme.mute} value={ai.model} onChangeText={(v) => setState({ ai: { ...ai, model: v } })} autoCapitalize="none" />
            <Btn title="Salvar chave" small onPress={() => { setState({ ai: { ...ai, apiKey: aiKeyInput.trim() } }); Alert.alert('Salvo', 'Chave armazenada apenas neste aparelho.'); }} />
            <Text style={{ color: theme.mute, fontSize: 12, marginTop: 6 }}>
              Use modelos ":free" do OpenRouter. A chave sai do aparelho somente para openrouter.ai ao pedir análise.
            </Text>
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>💾 Backup</Text>
        <Text style={{ color: theme.textDim, fontSize: 13, marginBottom: 8 }}>
          Exporta modo, regras e listas em JSON validado. Import rejeita payloads maliciosos.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Btn title="Exportar (copiar)" variant="ghost" small onPress={doExport} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn title="Importar (colar)" variant="ghost" small onPress={doImport} />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>📊 Base local</Text>
        <Row label="Registros de reputação" value={String(getDb().size)} />
        <Row label="Chamadas no histórico" value={String(history.length)} />
        <Row label="Armazenamento" value="somente no aparelho" color={theme.primary} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>ℹ️ Sobre</Text>
        <Row label="Versão" value="0.1.0 (MVP)" />
        <Row label="Licença" value="MIT (open source)" />
        <Row label="Telemetria" value="nenhuma" color={theme.primary} />
        <Row label="Anúncios" value="nenhum" color={theme.primary} />
        <Btn title="❤️ Apoiar o projeto" variant="ghost" style={{ marginTop: 8 }} onPress={() => router.push('/donate')} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>🔁 Reset</Text>
        <Btn
          title="Limpar histórico"
          variant="danger"
          small
          onPress={() => {
            Alert.alert('Confirmar', 'Apagar todo o histórico local?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Apagar', style: 'destructive', onPress: () => setState({ history: [] }) },
            ]);
          }}
        />
      </Card>

      <Text style={{ color: theme.mute, fontSize: 12, textAlign: 'center' }}>
        AntiSpam BR · fail-safe: em caso de dúvida, a chamada é permitida.
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
  },
});
