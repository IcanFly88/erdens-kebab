import Constants from 'expo-constants';

import type { NewOrderRequest, Order } from '@/lib/order-status';

/**
 * A backend címe. Buildben az EXPO_PUBLIC_API_URL környezeti változóból jön (eas.json);
 * fejlesztéskor a Metro szervert futtató gépen a 4000-es porton futó szervert használjuk
 * (`npm run server`).
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000`;
}

export const API_URL = resolveApiUrl();

const WAKING_MESSAGE = 'A rendelési rendszer most indul, próbáld újra pár másodperc múlva.';

export class ApiError extends Error {
  status: number;
  /** Ingyenes tárhelyen az alvó szerver ébredés közben nem JSON választ ad – ilyenkor biztonságos újrapróbálni. */
  waking: boolean;
  constructor(message: string, status = 0, waking = false) {
    super(message);
    this.status = status;
    this.waking = waking;
  }
}

async function request<T>(path: string, json?: unknown, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: json === undefined ? 'GET' : 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: json === undefined ? undefined : JSON.stringify(json),
      signal: controller.signal,
    });
    if (!res.headers.get('content-type')?.includes('application/json')) {
      throw new ApiError(WAKING_MESSAGE, res.status, true);
    }
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.error ?? 'Váratlan hiba történt, próbáld újra.', res.status);
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Nem érjük el a rendelési rendszert. Ellenőrizd az internetkapcsolatot!');
  } finally {
    clearTimeout(timer);
  }
}

/** Újrapróbálja a kérést, amíg a szerver ébred (legfeljebb `maxWaitMs`-ig). */
async function whileWaking<T>(fn: () => Promise<T>, maxWaitMs: number): Promise<T> {
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof ApiError && err.waking) || Date.now() > deadline) throw err;
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
}

export type LocationState = { id: string; paused: boolean; open: boolean; soldOut?: string[] };

export const api = {
  /** Felkelti az alvó szervert, amíg a vendég az étlapot nézi. */
  wake: () => request<{ ok: true }>('/health', undefined, 90_000).catch(() => null),
  status: () => request<{ locations: LocationState[] }>('/api/status').then((r) => r.locations),
  // Hosszú időkorlát, és csak a biztosan fel nem dolgozott (ébredés közbeni) kérést ismételjük,
  // hogy egy rendelés se menjen be kétszer.
  createOrder: (body: NewOrderRequest) =>
    whileWaking(() => request<{ order: Order }>('/api/orders', body, 90_000), 90_000).then(
      (r) => r.order,
    ),
  getOrder: (id: string) => request<{ order: Order }>(`/api/orders/${id}`).then((r) => r.order),
  registerPushToken: (orderId: string, token: string) =>
    request<{ ok: true }>(`/api/orders/${orderId}/push-token`, { token }),
};
