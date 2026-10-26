// Rendelés típusok és státusz-logika. Ezt a fájlt az app ÉS a szerver (server/) is használja,
// ezért nem importálhat semmit (a szerver Node-ban, alias nélkül tölti be).

export type Mode = 'delivery' | 'pickup';

export type PaymentMethod = 'cash' | 'card' | 'szep';

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'on_the_way'
  | 'ready'
  | 'completed'
  | 'rejected';

export type Address = {
  town: string;
  street: string;
  details: string;
  courierNote: string;
};

export type OrderLine = {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  selections: Record<string, string[]>;
  summary: string;
  note?: string;
};

export type Order = {
  id: string;
  number: string;
  createdAt: number;
  updatedAt: number;
  locationId: string;
  mode: Mode;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: number }[];
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  tip: number;
  total: number;
  payment: PaymentMethod;
  cutlery: boolean;
  contact: { name: string; phone: string };
  address?: Address;
  scheduledFor: number | null;
  /** Becsült érkezés/átvétel. Elfogadáskor az étterem pontosítja. */
  etaAt: number;
  rejectReason?: string;
};

/** A rendelés leadásakor a szervernek küldött adat. Az árakat a szerver számolja újra. */
export type NewOrderRequest = {
  locationId: string;
  mode: Mode;
  lines: { itemId: string; qty: number; selections: Record<string, string[]>; note?: string }[];
  contact: { name: string; phone: string };
  address?: Address;
  payment: PaymentMethod;
  tip: number;
  cutlery: boolean;
  scheduledFor: number | null;
  pushToken?: string | null;
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Készpénz átvételkor',
  card: 'Bankkártya átvételkor',
  szep: 'SZÉP-kártya átvételkor',
};

export const STEP_LABELS: Record<Mode, string[]> = {
  delivery: [
    'Rendelés elküldve',
    'Az étterem elfogadta',
    'Készül a rendelésed',
    'A futár úton van',
    'Kiszállítva',
  ],
  pickup: [
    'Rendelés elküldve',
    'Az étterem elfogadta',
    'Készül a rendelésed',
    'Átvehető az étteremben',
    'Átvéve',
  ],
};

const STEP_OF: Record<OrderStatus, number> = {
  pending: 0,
  accepted: 1,
  preparing: 2,
  on_the_way: 3,
  ready: 3,
  completed: 4,
  rejected: 0,
};

export function stepIndex(status: OrderStatus): number {
  return STEP_OF[status];
}

export function isFinal(status: OrderStatus): boolean {
  return status === 'completed' || status === 'rejected';
}

/** Az éttermi panel ezekre a státuszokra léptetheti tovább a rendelést. */
export function nextStatuses(mode: Mode, status: OrderStatus): OrderStatus[] {
  switch (status) {
    case 'accepted':
      return ['preparing'];
    case 'preparing':
      return [mode === 'delivery' ? 'on_the_way' : 'ready'];
    case 'on_the_way':
    case 'ready':
      return ['completed'];
    default:
      return [];
  }
}

/** Mikor mentek át az egyes lépéseken (a lépéslista időpontjaihoz). */
export function stepTimes(order: Pick<Order, 'statusHistory'>): (number | undefined)[] {
  const times: (number | undefined)[] = [];
  for (const h of order.statusHistory) {
    if (h.status === 'rejected') continue;
    const step = STEP_OF[h.status];
    times[step] ??= h.at;
  }
  return times;
}

/**
 * Értesítés szövege egy státuszváltáshoz (push és helyi értesítés is ezt használja).
 * Az időt a hívó formázza, mert a szerver és a telefon időzónája eltérhet.
 */
export function statusMessage(input: {
  status: OrderStatus;
  mode: Mode;
  etaText: string;
  scheduled: boolean;
  rejectReason?: string;
}): { title: string; body: string } | null {
  const { status, mode, etaText } = input;
  const delivery = mode === 'delivery';
  switch (status) {
    case 'accepted':
      return {
        title: 'Elfogadtuk az előrendelésed! 🗓️',
        body: `${delivery ? 'Kiszállítás' : 'Átvehető'}: ${etaText}`,
      };
    case 'preparing':
      return {
        title: input.scheduled ? 'Elkezdtük készíteni a rendelésed! 🔥' : 'Elfogadtuk a rendelésed! 🔥',
        body: delivery ? `Várható érkezés: ${etaText}` : `Átvehető kb. ${etaText}-kor`,
      };
    case 'on_the_way':
      return { title: 'Úton van a rendelésed 🛵', body: `A futár hamarosan nálad lesz (kb. ${etaText}).` };
    case 'ready':
      return { title: 'Átvehető a rendelésed! 🥙', body: 'Várunk az étteremben, még melegen.' };
    case 'completed':
      return {
        title: 'Jó étvágyat! 😋',
        body: 'Köszönjük, hogy az Erdens Kebabot választottad.',
      };
    case 'rejected':
      return {
        title: 'Sajnos nem tudjuk teljesíteni a rendelésed',
        body: input.rejectReason || 'Kérjük, hívd az éttermet a részletekért.',
      };
    default:
      return null;
  }
}
