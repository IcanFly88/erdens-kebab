import { useFocusEffect } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';

import { api } from '@/lib/api';

type RestaurantStatus = { paused: boolean; reachable: boolean };

// A panelen elfogyottnak jelölt termékek. Az étlap, a keresés, a termék lap és a kosár is
// ebből olvas; az állapot lekérdezésekor frissül (offline az utolsó ismert állapot marad).
let soldOutIds: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function setSoldOut(ids: string[]) {
  if (ids.length === soldOutIds.size && ids.every((id) => soldOutIds.has(id))) return;
  soldOutIds = new Set(ids);
  listeners.forEach((listener) => listener());
}

export function useSoldOut(): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => soldOutIds,
  );
}

/** Fogad-e az étterem online rendelést (a panelről szüneteltethető). Fókuszkor és percenként frissül. */
export function useRestaurantStatus(locationId: string): RestaurantStatus | null {
  const [status, setStatus] = useState<RestaurantStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = () =>
        api
          .status()
          .then((list) => {
            const location = list.find((l) => l.id === locationId);
            setSoldOut(location?.soldOut ?? []);
            if (active) setStatus({ paused: location?.paused ?? false, reachable: true });
          })
          .catch(() => {
            if (active) setStatus({ paused: false, reachable: false });
          });
      load();
      const timer = setInterval(load, 60_000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [locationId]),
  );

  return status;
}
