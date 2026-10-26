import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { hasRequiredOptions, type MenuItem } from '@/data/menu';
import { useApp } from '@/store/app-store';

/**
 * "+" gomb: ha a terméknél kötelező választani (pl. hús, szósz), megnyitja a termék lapot,
 * különben egyből a kosárba teszi.
 */
export function useQuickAdd() {
  const { dispatch } = useApp();
  return (item: MenuItem) => {
    if (hasRequiredOptions(item)) {
      router.push({ pathname: '/product/[id]', params: { id: item.id } });
      return;
    }
    dispatch({ type: 'addLine', line: { itemId: item.id, qty: 1, selections: {} } });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
}

export function openProduct(item: MenuItem) {
  router.push({ pathname: '/product/[id]', params: { id: item.id } });
}
