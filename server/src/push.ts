import { statusMessage } from '../../src/lib/order-status.ts';
import type { StoredOrder } from './store.ts';
import { formatTime } from './time.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

/**
 * Push értesítés a vendégnek az Expo Push szolgáltatáson keresztül.
 * Csak akkor küld, ha a telefon regisztrált Expo push tokent (fejlesztői vagy éles buildben).
 */
export async function notifyCustomer(order: StoredOrder): Promise<void> {
  const token = order.pushToken;
  if (!token || !TOKEN_PATTERN.test(token)) return;
  const message = statusMessage({
    status: order.status,
    mode: order.mode,
    etaText: formatTime(order.etaAt),
    scheduled: order.scheduledFor !== null,
    rejectReason: order.rejectReason,
  });
  if (!message) return;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN
          ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        to: token,
        ...message,
        sound: 'default',
        priority: 'high',
        channelId: 'orders',
        data: { orderId: order.id, status: order.status },
      }),
    });
    const json = (await res.json()) as { data?: { status: string; message?: string } };
    if (json.data?.status === 'error') {
      console.warn(`[push] ${order.number}: ${json.data.message}`);
    }
  } catch (err) {
    console.warn(`[push] ${order.number}: küldés sikertelen`, err);
  }
}
