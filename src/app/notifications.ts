import * as Notifications from 'expo-notifications';

/** Notificações exibidas mesmo em foreground (status de chamadas). */
export function getDefaultExpoNotificationBehavior(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const s = await Notifications.getPermissionsAsync();
    if (s.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}
