import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { api } from '@/lib/api';

type RestaurantStatus = { paused: boolean; reachable: boolean };

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
            if (active) {
              setStatus({ paused: list.find((l) => l.id === locationId)?.paused ?? false, reachable: true });
            }
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
