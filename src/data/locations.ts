// Étterem adatai. Forrás: erdenskebap.hu, @erdenskebab TikTok, online cégjegyzékek (2026. október).
// A szállítási díjak becsültek — élesítés előtt egyeztesd az étteremmel!
// A rendszer több üzletet is kezel: új üzlethez elég egy újabb elem a LOCATIONS listában.

export type LocationId = 'monor';

/** Nyitvatartás egy napra ("HH:MM"), vagy null, ha zárva. */
export type DayHours = { open: string; close: string } | null;

export type DeliveryZone = {
  town: string;
  fee: number;
  /** Becsült kiszállítási idő percben [min, max]. */
  eta: [number, number];
};

export type Location = {
  id: LocationId;
  name: string;
  city: string;
  address: string;
  phone: string;
  mapsUrl: string;
  /** Index = Date.getDay(), azaz 0 = vasárnap. */
  hours: DayHours[];
  deliveryZones: DeliveryZone[];
  minOrder: number;
  pickupEta: [number, number];
};

export const LOCATIONS: Location[] = [
  {
    id: 'monor',
    name: 'Erdens Kebab Monor',
    city: 'Monor',
    address: '2200 Monor, Kiss Ernő u. 1.',
    phone: '+36 30 528 5188',
    mapsUrl: 'https://maps.app.goo.gl/1uaRdach8iUJZaGJ9',
    hours: [
      null,
      { open: '10:30', close: '20:00' },
      { open: '10:30', close: '20:00' },
      { open: '10:30', close: '20:00' },
      { open: '10:30', close: '20:00' },
      { open: '10:30', close: '20:00' },
      { open: '10:30', close: '20:00' },
    ],
    deliveryZones: [
      { town: 'Monor', fee: 390, eta: [25, 40] },
      { town: 'Vasad', fee: 790, eta: [35, 50] },
      { town: 'Csévharaszt', fee: 790, eta: [35, 50] },
      { town: 'Péteri', fee: 790, eta: [35, 50] },
      { town: 'Gomba', fee: 990, eta: [40, 55] },
    ],
    minOrder: 3000,
    pickupEta: [10, 15],
  },
];

export const RESTAURANT = {
  name: "Erden's Kebab",
  tagline: 'Török · Kebab · Halal',
  rating: 4.6,
  ratingCount: '10+',
  website: 'https://erdenskebap.hu',
  tiktok: 'https://www.tiktok.com/@erdenskebab',
  heroImage:
    'https://images.unsplash.com/photo-1530469912745-a215c6b256ea?w=1200&q=80&auto=format&fit=crop',
};

export function getLocation(id: string): Location {
  return LOCATIONS.find((l) => l.id === id) ?? LOCATIONS[0];
}
