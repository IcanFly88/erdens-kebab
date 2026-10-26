import { requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

// Az Android Expo Go-ból hiányoznak az expo-notifications natív moduljai, ezért ott már az
// importja is hibát dob. Ilyenkor értesítések nélkül fut az app (a státusz az appban így is frissül);
// fejlesztői és éles buildben, illetve iOS-en minden működik.
const supported =
  Platform.OS !== 'web' &&
  requireOptionalNativeModule('ExpoApplication') !== null &&
  (Platform.OS !== 'android' || requireOptionalNativeModule('ExpoTopicSubscriptionModule') !== null);

const Notifications: NotificationsModule | null = supported
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-notifications')
  : null;

// Előtérben is jelenjen meg az értesítés (pl. "Úton van a rendelésed").
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Értesítési engedélyt kér, és ha lehet, Expo push tokent ad vissza.
 * Távoli push-hoz EAS projekt kell (`npx eas-cli@latest init`) és fejlesztői/éles build;
 * enélkül a helyi értesítések mennek, amíg az app fut.
 */
export async function setupNotifications(): Promise<{ granted: boolean; pushToken: string | null }> {
  if (!Notifications) return { granted: false, pushToken: null };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Rendelések állapota',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { granted: false, pushToken: null };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { granted: true, pushToken: null };
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { granted: true, pushToken: data };
  } catch {
    return { granted: true, pushToken: null };
  }
}

export async function showLocalNotification(
  message: { title: string; body: string },
  data: Record<string, string>,
) {
  if (!Notifications) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    content: { ...message, data, sound: 'default' },
    trigger: Platform.OS === 'android' ? { channelId: 'orders' } : null,
  });
}

/** Értesítésre koppintva (akár hidegindításkor is) meghívja `open`-t a rendelés azonosítójával. */
export function useNotificationTap(open: (orderId: string) => void) {
  useEffect(() => {
    if (!Notifications) return;
    const handle = (response: import('expo-notifications').NotificationResponse | null) => {
      const orderId = response?.notification.request.content.data?.orderId;
      if (typeof orderId === 'string') open(orderId);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      handle(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [open]);
}
