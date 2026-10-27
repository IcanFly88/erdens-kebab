import { randomUUID } from 'node:crypto';

import { getLocation, LOCATIONS } from '../../src/data/locations.ts';
import {
  describeSelections,
  getItem,
  groupsFor,
  missingRequired,
  unitPrice,
} from '../../src/data/menu.ts';
import type { NewOrderRequest, OrderLine, PaymentMethod } from '../../src/lib/order-status.ts';
import type { StoredOrder } from './store.ts';
import { budapest, isOpenAt } from './time.ts';

export class ValidationError extends Error {}

const PAYMENTS: PaymentMethod[] = ['cash', 'card', 'szep'];
const MIN_LEAD_MS = 15 * 60_000;
const MAX_AHEAD_MS = 3 * 24 * 60 * 60_000;

function str(value: unknown, max: number, field: string, required = false): string {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new ValidationError(`Hibás mező: ${field}`);
  const s = value.trim();
  if (required && !s) throw new ValidationError(`Hiányzó mező: ${field}`);
  if (s.length > max) throw new ValidationError(`Túl hosszú mező: ${field}`);
  return s;
}

function int(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`Hibás érték: ${field}`);
  }
  return value;
}

/**
 * Ellenőrzi a beérkező rendelést, és a szerver oldali étlap alapján újraszámolja az árakat —
 * a telefonról érkező árakban nem bízunk meg.
 */
export function buildOrder(
  raw: unknown,
  opts: { now: number; paused: boolean; sequence: number },
): StoredOrder {
  if (!raw || typeof raw !== 'object') throw new ValidationError('Hibás kérés');
  const req = raw as Partial<NewOrderRequest>;

  if (!LOCATIONS.some((l) => l.id === req.locationId)) throw new ValidationError('Ismeretlen étterem');
  const location = getLocation(req.locationId as string);
  if (opts.paused) {
    throw new ValidationError('Az étterem jelenleg nem fogad online rendelést. Kérjük, hívd telefonon!');
  }
  if (req.mode !== 'delivery' && req.mode !== 'pickup') throw new ValidationError('Hibás átvételi mód');
  const mode = req.mode;

  if (!Array.isArray(req.lines) || req.lines.length === 0) throw new ValidationError('Üres a kosár');
  if (req.lines.length > 40) throw new ValidationError('Túl sok tétel');

  const lines: OrderLine[] = req.lines.map((l, i) => {
    const item = getItem(l?.itemId);
    if (!item) throw new ValidationError(`Ismeretlen termék (${i + 1}. tétel)`);
    const qty = int(l.qty, 1, 50, 'mennyiség');
    const selections: Record<string, string[]> = {};
    const given = (l.selections && typeof l.selections === 'object' ? l.selections : {}) as Record<
      string,
      unknown
    >;
    for (const group of groupsFor(item)) {
      const chosen = given[group.id];
      if (chosen === undefined) continue;
      if (!Array.isArray(chosen) || chosen.some((c) => !group.choices.some((x) => x.id === c))) {
        throw new ValidationError(`Hibás választás: ${item.name}`);
      }
      const limit = group.type === 'single' ? 1 : (group.max ?? group.choices.length);
      if (new Set(chosen).size !== chosen.length || chosen.length > limit) {
        throw new ValidationError(`Túl sok választás: ${item.name}`);
      }
      if (chosen.length) selections[group.id] = chosen as string[];
    }
    for (const key of Object.keys(given)) {
      if (!item.optionGroups?.includes(key)) throw new ValidationError(`Hibás opció: ${item.name}`);
    }
    const missing = missingRequired(item, selections);
    if (missing) throw new ValidationError(`${item.name}: válassz – ${missing.title.toLowerCase()}`);
    const note = str(l.note, 140, 'megjegyzés');
    return {
      itemId: item.id,
      name: item.name,
      qty,
      unitPrice: unitPrice(item, selections),
      selections,
      summary: describeSelections(item, selections),
      ...(note ? { note } : {}),
    };
  });

  const contact = {
    name: str(req.contact?.name, 80, 'név', true),
    phone: str(req.contact?.phone, 30, 'telefonszám', true),
  };
  if (contact.phone.replace(/\D/g, '').length < 9) throw new ValidationError('Érvénytelen telefonszám');

  if (!PAYMENTS.includes(req.payment as PaymentMethod)) throw new ValidationError('Hibás fizetési mód');
  const cutlery = req.cutlery === true;

  let address: StoredOrder['address'];
  let deliveryFee = 0;
  let eta = location.pickupEta;
  if (mode === 'delivery') {
    const zone = location.deliveryZones.find((z) => z.town === req.address?.town);
    if (!zone) throw new ValidationError('Erre a településre ebből az étteremből nem szállítunk');
    address = {
      town: zone.town,
      street: str(req.address?.street, 120, 'utca, házszám', true),
      details: str(req.address?.details, 120, 'emelet, ajtó'),
      courierNote: str(req.address?.courierNote, 200, 'üzenet a futárnak'),
    };
    deliveryFee = zone.fee;
    eta = zone.eta;
  }
  const tip = mode === 'delivery' ? int(req.tip ?? 0, 0, 5000, 'borravaló') : 0;

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  if (mode === 'delivery' && subtotal < location.minOrder) {
    throw new ValidationError(`A minimális rendelési érték kiszállításnál ${location.minOrder} Ft`);
  }

  const { now } = opts;
  let scheduledFor: number | null = null;
  if (req.scheduledFor !== null && req.scheduledFor !== undefined) {
    scheduledFor = int(req.scheduledFor, now + MIN_LEAD_MS, now + MAX_AHEAD_MS, 'időpont');
    if (!isOpenAt(location, scheduledFor)) {
      throw new ValidationError('A választott időpontban az étterem zárva van');
    }
  } else if (!isOpenAt(location, now, 20)) {
    throw new ValidationError('Az étterem most zárva van – válassz későbbi időpontot');
  }

  const prefix = location.city.charAt(0).toUpperCase();
  return {
    id: randomUUID(),
    number: `${prefix}-${String(opts.sequence).padStart(3, '0')}`,
    createdAt: now,
    updatedAt: now,
    locationId: location.id,
    mode,
    status: 'pending',
    statusHistory: [{ status: 'pending', at: now }],
    lines,
    subtotal,
    deliveryFee,
    tip,
    total: subtotal + deliveryFee + tip,
    payment: req.payment as PaymentMethod,
    cutlery,
    contact,
    address,
    scheduledFor,
    etaAt: scheduledFor ?? now + eta[1] * 60_000,
    pushToken: typeof req.pushToken === 'string' ? req.pushToken.slice(0, 200) : undefined,
  };
}

/** A mai napi sorszám étteremenként (pl. M-001), budapesti nap szerint. */
export function nextSequence(todaysOrders: StoredOrder[], now: number): number {
  const today = budapest(now).date;
  return todaysOrders.filter((o) => budapest(o.createdAt).date === today).length + 1;
}
