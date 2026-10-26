import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { api, ApiError } from '@/lib/api';
import { formatDayTime, formatTime } from '@/lib/format';
import { showLocalNotification, useNotificationTap } from '@/lib/notifications';
import { isFinal, statusMessage, type Order } from '@/lib/order-status';
import { useApp } from '@/store/app-store';

const POLL_MS = 4_000;

/**
 * A folyamatban lévő rendelések állapotát frissíti a szerverről, amíg az app előtérben van.
 * Ha nincs távoli push (pl. Expo Go-ban), státuszváltáskor helyi értesítést mutat.
 * Értesítésre koppintva megnyitja a rendelés követését.
 */
export function OrderSync() {
  const { orders, pushToken, dispatch } = useApp();
  const latest = useRef({ orders, pushToken });

  useEffect(() => {
    latest.current = { orders, pushToken };
  });

  // Ingyenes tárhelyen a szerver alhat: induláskor felébresztjük, amíg a vendég az étlapot nézi.
  useEffect(() => {
    api.wake();
  }, []);

  const activeKey = orders
    .filter((o) => !isFinal(o.status))
    .map((o) => `${o.id}:${o.updatedAt}`)
    .join(',');

  useEffect(() => {
    if (!activeKey) return;
    let stopped = false;
    const tick = async () => {
      if (AppState.currentState !== 'active') return;
      for (const local of latest.current.orders.filter((o) => !isFinal(o.status))) {
        const fresh = await api
          .getOrder(local.id)
          .catch((err) => (err instanceof ApiError && err.status === 404 ? 'gone' : null));
        if (stopped || !fresh) continue;
        if (fresh === 'gone') {
          dispatch({ type: 'updateOrder', order: lostOrder(local) });
          continue;
        }
        if (fresh.updatedAt === local.updatedAt) continue;
        dispatch({ type: 'updateOrder', order: fresh });
        if (fresh.status !== local.status && !latest.current.pushToken) notify(fresh);
      }
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [activeKey, dispatch]);

  useNotificationTap(openOrder);

  return null;
}

/** A szerver már nem ismeri a rendelést (pl. törölt adatbázis) – lezárjuk, hogy ne ragadjon be. */
function lostOrder(order: Order): Order {
  const now = Date.now();
  return {
    ...order,
    status: 'rejected',
    rejectReason: 'A rendelés már nem található a rendszerben. Kérjük, hívd az éttermet.',
    statusHistory: [...order.statusHistory, { status: 'rejected', at: now }],
    updatedAt: now,
  };
}

function openOrder(orderId: string) {
  router.push({ pathname: '/order/[id]', params: { id: orderId } });
}

function notify(order: Order) {
  const message = statusMessage({
    status: order.status,
    mode: order.mode,
    etaText: order.status === 'accepted' ? formatDayTime(order.etaAt) : formatTime(order.etaAt),
    scheduled: order.scheduledFor !== null,
    rejectReason: order.rejectReason,
  });
  if (message) showLocalNotification(message, { orderId: order.id }).catch(() => {});
}
