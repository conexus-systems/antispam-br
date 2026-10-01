import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { hydrate, getState } from '../src/app/store';
import { ensureDb } from '../src/app/screening';
import { theme } from '../src/ui/theme';
import { getDefaultExpoNotificationBehavior } from '../src/app/notifications';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      await hydrate();
      await ensureDb();
      await getDefaultExpoNotificationBehavior();
      setReady(true);
    })();
  }, []);

  if (!ready || !getState().hydrated) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="verify" />
        <Stack.Screen name="donate" />
      </Stack>
    </View>
  );
}
