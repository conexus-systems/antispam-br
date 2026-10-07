import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsNS from 'expo-notifications';

/**
 * True quando rodando dentro do Expo Go — a API de push remoto do
 * expo-notifications foi removida do Expo Go no SDK 53.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Acesso LAZY ao expo-notifications.
 *
 * NÃO importe 'expo-notifications' estaticamente: no Android/Expo Go (SDK 53+)
 * o módulo registra um listener de push token no escopo do módulo
 * (DevicePushTokenAutoRegistration.fx) e isso LANÇA erro no import, quebrando
 * a avaliação de qualquer módulo que o importe (telas ficam sem default export).
 * Em dev/production builds o carregamento funciona normalmente e as
 * notificações locais continuam operando.
 */
export function getNotifications(): typeof NotificationsNS | null {
  if (isExpoGo) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as typeof NotificationsNS;
  } catch {
    return null;
  }
}

/** Notificações exibidas mesmo em foreground (status de chamadas). No-op no Expo Go. */
export function getDefaultExpoNotificationBehavior(): void {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // ambiente sem suporte — não deve quebrar o app
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    const s = await Notifications.getPermissionsAsync();
    if (s.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}
