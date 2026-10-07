import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { theme } from '../../src/ui/theme';

const ICONS: Record<string, string> = {
  index: '🛡️',
  history: '📜',
  verify: '🔍',
  sms: '✉️',
  settings: '⚙️',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border, height: 62, paddingBottom: 8 },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => (
          <Text style={{ fontSize: focused ? size : size - 2, opacity: focused ? 1 : 0.75 }}>
            {ICONS[typeof color === 'string' ? '' : ''] ?? ''}
          </Text>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="history" options={{ title: 'Histórico' }} />
      <Tabs.Screen name="verify" options={{ title: 'Verificar' }} />
      <Tabs.Screen name="sms" options={{ title: 'SMS' }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes' }} />
    </Tabs>
  );
}
