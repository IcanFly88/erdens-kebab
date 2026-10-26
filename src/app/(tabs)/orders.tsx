import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { T } from '@/components/ui/text';
import { Colors, Radius } from '@/constants/theme';
import { getLocation } from '@/data/locations';
import { formatDayTime, formatPrice } from '@/lib/format';
import { isFinal, STEP_LABELS, stepIndex, type Order } from '@/lib/order-status';
import { useNow } from '@/lib/use-now';
import { useStatusBarStyle } from '@/lib/use-status-bar';
import { useApp } from '@/store/app-store';

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { orders, dispatch } = useApp();
  const now = useNow(5_000);

  useStatusBarStyle('dark');

  const reorder = (order: Order) => {
    dispatch({ type: 'reorder', order });
    router.push('/cart');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <T variant="h1" style={styles.title}>
        Rendeléseim
      </T>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={orders.length ? styles.list : styles.emptyList}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="Még nincs rendelésed"
            text="Válassz kedvenc kebabjaid közül – itt követheted majd a rendelésed útját."
            action={
              <Button title="Irány az étlap" onPress={() => router.navigate('/')} style={styles.cta} />
            }
          />
        }
        renderItem={({ item: order }) => {
          const finished = isFinal(order.status);
          const loc = getLocation(order.locationId);
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.cardTop}>
                <View style={styles.storeIcon}>
                  <Ionicons name="storefront" size={18} color={Colors.brand} />
                </View>
                <View style={styles.flex}>
                  <T variant="h3">{loc.name}</T>
                  <T variant="small" color={Colors.textMuted}>
                    {formatDayTime(order.createdAt, now)} · {order.number}
                  </T>
                </View>
                <StatusPill order={order} />
              </View>
              <T variant="small" color={Colors.textMuted} numberOfLines={2}>
                {order.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}
              </T>
              <View style={styles.cardBottom}>
                <T variant="bodyStrong">{formatPrice(order.total)}</T>
                {finished ? (
                  <Button
                    title="Újrarendelés"
                    size="md"
                    variant="outline"
                    onPress={() => reorder(order)}
                    left={<Ionicons name="refresh" size={16} color={Colors.ink} />}
                  />
                ) : (
                  <Button
                    title="Követés"
                    size="md"
                    onPress={() =>
                      router.push({ pathname: '/order/[id]', params: { id: order.id } })
                    }
                    left={<Ionicons name="navigate" size={16} color={Colors.white} />}
                  />
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function StatusPill({ order }: { order: Order }) {
  const [bg, fg, label] =
    order.status === 'rejected'
      ? [Colors.dangerSoft, Colors.danger, 'Elutasítva']
      : order.status === 'completed'
        ? [Colors.successSoft, Colors.success, STEP_LABELS[order.mode][4]]
        : order.status === 'pending'
          ? [Colors.brandSoft, Colors.brandDark, 'Visszaigazolásra vár']
          : [Colors.brandSoft, Colors.brandDark, STEP_LABELS[order.mode][stepIndex(order.status)]];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <T variant="caption" color={fg}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgSoft },
  title: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  list: { padding: 16, gap: 12 },
  emptyList: { flexGrow: 1 },
  cta: { alignSelf: 'stretch', marginTop: 8 },
  card: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: { opacity: 0.85 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
});
