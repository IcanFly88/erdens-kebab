import type { OrderStatus, PaymentMethod } from '../../src/lib/order-status.ts';
import type { StoredOrder } from './store.ts';
import { budapest } from './time.ts';

// Kimutatás az éttermi panelnek: hány rendelés jött az appból, hány vendégtől, mennyi forgalommal.
// Minden nap és óra budapesti idő szerint értendő.

export const PERIODS = { today: 1, '7d': 7, '30d': 30 } as const;
export type Period = keyof typeof PERIODS;

const HOUR = 60 * 60_000;

/** Budapesti éjfél azon a napon, amelyre `ts` esik. */
function midnight(ts: number): number {
  return ts - budapest(ts).minutes * 60_000 - (ts % 60_000);
}

/** Az időszak első napjának éjfele (ma = 1 nap). Óraátállításkor is pontos. */
export function periodStart(now: number, days: number): number {
  let start = midnight(now);
  for (let i = 1; i < days; i++) start = midnight(start - 12 * HOUR);
  return start;
}

/** A telefonszám utolsó 9 számjegye – így a +36 30… és a 06 30… ugyanaz a vendég. */
const customerKey = (phone: string) => phone.replace(/\D/g, '').slice(-9);

/**
 * @param history az időszaknál régebbi rendelések is (a visszatérő vendégek felismeréséhez)
 */
export function computeStats(history: StoredOrder[], now: number, period: Period) {
  const days = PERIODS[period];
  const from = periodStart(now, days);
  const inPeriod = history.filter((o) => o.createdAt >= from);
  const valid = inPeriod.filter((o) => o.status !== 'rejected');
  const revenue = valid.reduce((s, o) => s + o.total, 0);

  // Vendégek: egyedi telefonszámok. Visszatérő az, aki az időszakban rendelt, és összesen
  // (a korábbi rendeléseivel együtt) legalább kétszer.
  const ordersPerCustomer = new Map<string, number>();
  for (const o of history) {
    if (o.status === 'rejected') continue;
    const key = customerKey(o.contact.phone);
    ordersPerCustomer.set(key, (ordersPerCustomer.get(key) ?? 0) + 1);
  }
  const customers = new Set(valid.map((o) => customerKey(o.contact.phone)));
  const returning = [...customers].filter((key) => (ordersPerCustomer.get(key) ?? 0) >= 2).length;

  const waits = valid.flatMap((o) => {
    const accepted = o.statusHistory.find((h) => h.status === 'accepted' || h.status === 'preparing');
    return accepted ? [accepted.at - o.createdAt] : [];
  });

  const perDay = new Map<string, { date: string; orders: number; revenue: number }>();
  for (let day = from; day <= now; day = midnight(day + 36 * HOUR)) {
    const date = budapest(day).date;
    perDay.set(date, { date, orders: 0, revenue: 0 });
  }
  const perHour = new Array<number>(24).fill(0);
  const items = new Map<string, { name: string; qty: number; revenue: number }>();
  const payments: Record<PaymentMethod, number> = { cash: 0, card: 0, szep: 0 };
  for (const o of valid) {
    const t = budapest(o.createdAt);
    const day = perDay.get(t.date);
    if (day) {
      day.orders += 1;
      day.revenue += o.total;
    }
    perHour[Math.floor(t.minutes / 60)] += 1;
    payments[o.payment] += 1;
    for (const l of o.lines) {
      const row = items.get(l.itemId) ?? { name: l.name, qty: 0, revenue: 0 };
      row.qty += l.qty;
      row.revenue += l.qty * l.unitPrice;
      items.set(l.itemId, row);
    }
  }

  return {
    period,
    from,
    to: now,
    orders: valid.length,
    rejected: inPeriod.length - valid.length,
    completed: valid.filter((o) => o.status === 'completed').length,
    revenue,
    avgBasket: valid.length ? Math.round(revenue / valid.length) : 0,
    customers: customers.size,
    returning,
    delivery: valid.filter((o) => o.mode === 'delivery').length,
    pickup: valid.filter((o) => o.mode === 'pickup').length,
    scheduled: valid.filter((o) => o.scheduledFor).length,
    avgAcceptMs: waits.length ? Math.round(waits.reduce((s, ms) => s + ms, 0) / waits.length) : null,
    payments,
    perDay: [...perDay.values()],
    perHour,
    topItems: [...items.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 8),
  };
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Elfogadásra vár',
  accepted: 'Elfogadva',
  preparing: 'Készül',
  on_the_way: 'Futárnál',
  ready: 'Átvehető',
  completed: 'Teljesítve',
  rejected: 'Elutasítva',
};
const PAYMENT_SHORT: Record<PaymentMethod, string> = {
  cash: 'Készpénz',
  card: 'Bankkártya',
  szep: 'SZÉP-kártya',
};

/**
 * Rendelések táblázatként (Excelben megnyitható CSV, pontosvesszővel). Név és telefonszám
 * nélkül, hogy a fájl továbbküldhető legyen.
 */
export function ordersCsv(orders: StoredOrder[]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    'Sorszám',
    'Dátum',
    'Idő',
    'Állapot',
    'Átvétel',
    'Település',
    'Tételek',
    'Darab',
    'Részösszeg (Ft)',
    'Csomagolás (Ft)',
    'Szállítási díj (Ft)',
    'Borravaló (Ft)',
    'Összesen (Ft)',
    'Fizetés',
  ];
  const rows = [...orders]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((o) => {
      const t = budapest(o.createdAt);
      return [
        o.number,
        t.date,
        t.time,
        STATUS_LABELS[o.status],
        o.mode === 'delivery' ? 'Kiszállítás' : 'Elvitel',
        o.address?.town ?? '',
        o.lines.map((l) => `${l.qty}× ${l.name}${l.summary ? ` (${l.summary})` : ''}`).join(', '),
        o.lines.reduce((n, l) => n + l.qty, 0),
        o.subtotal,
        o.packagingFee ?? 0,
        o.deliveryFee,
        o.tip,
        o.total,
        PAYMENT_SHORT[o.payment],
      ];
    });
  // A BOM miatt az Excel helyesen, UTF-8-ként nyitja meg az ékezeteket.
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
