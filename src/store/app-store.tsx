import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useReducer, type ReactNode } from 'react';

import { getLocation, LOCATIONS, type Location, type LocationId } from '@/data/locations';
import {
  getItem,
  missingRequired,
  packagingFor,
  sanitizeSelections,
  unitPrice,
  type Selections,
} from '@/data/menu';
import { newId } from '@/lib/format';
import type { Address, Mode, Order } from '@/lib/order-status';

const STORAGE_KEY = 'erdens-kebab/state-v1';

export type CartLine = {
  key: string;
  itemId: string;
  qty: number;
  selections: Selections;
  note?: string;
};

export type Profile = { name: string; phone: string; email: string };

type State = {
  hydrated: boolean;
  locationId: LocationId;
  mode: Mode;
  cart: CartLine[];
  address: Address;
  profile: Profile;
  orders: Order[];
  /** Expo push token, ha a telefon kapott ilyet (fejlesztői vagy éles build). */
  pushToken: string | null;
};

type PersistedState = Omit<State, 'hydrated'>;

type Action =
  | { type: 'hydrate'; state: Partial<PersistedState> }
  | { type: 'setMode'; mode: Mode }
  | { type: 'addLine'; line: Omit<CartLine, 'key'> }
  | { type: 'replaceLine'; key: string; line: Omit<CartLine, 'key'> }
  | { type: 'changeQty'; key: string; delta: number }
  | { type: 'clearCart' }
  | { type: 'setAddress'; address: Address }
  | { type: 'setProfile'; profile: Profile }
  | { type: 'placeOrder'; order: Order }
  | { type: 'updateOrder'; order: Order }
  | { type: 'reorder'; order: Order }
  | { type: 'setPushToken'; token: string | null }
  | { type: 'reset' };

const initialState: State = {
  hydrated: false,
  locationId: 'monor',
  mode: 'delivery',
  cart: [],
  address: { town: 'Monor', street: '', details: '', courierNote: '' },
  profile: { name: '', phone: '', email: '' },
  orders: [],
  pushToken: null,
};

const sameLine = (a: Omit<CartLine, 'key'>, b: Omit<CartLine, 'key'>) =>
  a.itemId === b.itemId &&
  (a.note ?? '') === (b.note ?? '') &&
  JSON.stringify(a.selections) === JSON.stringify(b.selections);

function addOrMerge(cart: CartLine[], line: Omit<CartLine, 'key'>): CartLine[] {
  const existing = cart.find((l) => sameLine(l, line));
  if (existing) {
    return cart.map((l) => (l === existing ? { ...l, qty: l.qty + line.qty } : l));
  }
  return [...cart, { ...line, key: newId() }];
}

const isLocationId = (id: string): id is LocationId => LOCATIONS.some((l) => l.id === id);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate': {
      // A korábbi, szerver nélküli (demó) rendeléseknek nincs státuszuk – ezeket eldobjuk.
      const orders = (action.state.orders ?? []).filter((o) => typeof o.status === 'string');
      // Egy korábbi verzióban mentett, már nem létező üzletet és települést lecseréljük.
      const saved = action.state.locationId;
      const locationId = saved && isLocationId(saved) ? saved : LOCATIONS[0].id;
      const zones = getLocation(locationId).deliveryZones;
      const address = action.state.address ?? state.address;
      // Az étlap változhat: a már nem létező tételeket és opciókat kivesszük a mentett kosárból
      // (ha emiatt egy kötelező választás – pl. a szósz – hiányozna, a tételt is).
      const cart = (action.state.cart ?? []).flatMap((l) => {
        const item = getItem(l.itemId);
        if (!item) return [];
        const selections = sanitizeSelections(item, l.selections);
        return missingRequired(item, selections) ? [] : [{ ...l, selections }];
      });
      return {
        ...state,
        ...action.state,
        orders,
        cart,
        locationId,
        address: zones.some((z) => z.town === address.town)
          ? address
          : { ...address, town: zones[0].town },
        hydrated: true,
      };
    }
    case 'setMode':
      return { ...state, mode: action.mode };
    case 'addLine':
      return { ...state, cart: addOrMerge(state.cart, action.line) };
    case 'replaceLine':
      return {
        ...state,
        cart: state.cart.map((l) => (l.key === action.key ? { ...action.line, key: l.key } : l)),
      };
    case 'changeQty':
      return {
        ...state,
        cart: state.cart
          .map((l) => (l.key === action.key ? { ...l, qty: l.qty + action.delta } : l))
          .filter((l) => l.qty > 0),
      };
    case 'clearCart':
      return { ...state, cart: [] };
    case 'setAddress':
      return { ...state, address: action.address };
    case 'setProfile':
      return { ...state, profile: action.profile };
    case 'placeOrder':
      return { ...state, cart: [], orders: [action.order, ...state.orders] };
    case 'updateOrder':
      return {
        ...state,
        orders: state.orders.map((o) => (o.id === action.order.id ? action.order : o)),
      };
    case 'reorder': {
      const { order } = action;
      return {
        ...state,
        locationId: isLocationId(order.locationId) ? order.locationId : state.locationId,
        cart: order.lines.reduce((cart, l) => {
          const item = getItem(l.itemId);
          if (!item) return cart;
          const selections = sanitizeSelections(item, l.selections);
          if (missingRequired(item, selections)) return cart;
          return addOrMerge(cart, { itemId: l.itemId, qty: l.qty, selections, note: l.note });
        }, state.cart),
      };
    }
    case 'setPushToken':
      return { ...state, pushToken: action.token };
    case 'reset':
      return { ...initialState, hydrated: true };
  }
}

type AppContextValue = State & {
  location: Location;
  cartCount: number;
  subtotal: number;
  /** Csomagolási díj a kosár tételei után. */
  packaging: number;
  dispatch: (action: Action) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => dispatch({ type: 'hydrate', state: raw ? JSON.parse(raw) : {} }))
      .catch(() => dispatch({ type: 'hydrate', state: {} }));
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const { hydrated: _, ...persisted } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => {});
  }, [state]);

  const cartCount = state.cart.reduce((n, l) => n + l.qty, 0);
  const subtotal = state.cart.reduce((sum, l) => {
    const item = getItem(l.itemId);
    return item ? sum + unitPrice(item, l.selections) * l.qty : sum;
  }, 0);

  const value: AppContextValue = {
    ...state,
    location: getLocation(state.locationId),
    cartCount,
    subtotal,
    packaging: packagingFor(state.cart),
    dispatch,
  };

  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp(): AppContextValue {
  const ctx = use(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export function deliveryZone(location: Location, town: string) {
  return location.deliveryZones.find((z) => z.town === town) ?? location.deliveryZones[0];
}
