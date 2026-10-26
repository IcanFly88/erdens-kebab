import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OpenBadge } from '@/components/open-badge';
import { T } from '@/components/ui/text';
import { Colors, Radius } from '@/constants/theme';
import { LOCATIONS } from '@/data/locations';
import { hoursLabel, openStatus } from '@/lib/hours';
import { useNow } from '@/lib/use-now';
import { useApp } from '@/store/app-store';

export default function LocationSheet() {
  const insets = useSafeAreaInsets();
  const { locationId, dispatch } = useApp();
  const now = useNow();
  const today = new Date(now);

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 16 }]}>
      <T variant="h2">Válassz éttermet</T>
      <T variant="small" color={Colors.textMuted}>
        Két helyen várunk – a kiválasztott étteremből szállítunk, vagy ott veheted át a rendelésed.
      </T>
      {LOCATIONS.map((loc) => {
        const selected = loc.id === locationId;
        return (
          <Pressable
            key={loc.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              dispatch({ type: 'setLocation', id: loc.id });
              router.back();
            }}
            style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.pressed]}>
            <View style={styles.row}>
              <View style={[styles.icon, selected && styles.iconSelected]}>
                <Ionicons name="storefront" size={20} color={selected ? Colors.white : Colors.brand} />
              </View>
              <View style={styles.flex}>
                <T variant="h3">{loc.city}</T>
                <T variant="small" color={Colors.textMuted}>
                  {loc.address}
                </T>
              </View>
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={selected ? Colors.brand : Colors.border}
              />
            </View>
            <View style={styles.meta}>
              <OpenBadge status={openStatus(loc, today)} />
              <T variant="small" color={Colors.textMuted}>
                Ma: {hoursLabel(loc, today.getDay())}
              </T>
            </View>
            <T variant="small" color={Colors.textMuted}>
              Kiszállítás: {loc.deliveryZones.map((z) => z.town).join(', ')}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 28, gap: 12, backgroundColor: Colors.bg },
  card: {
    padding: 14,
    gap: 10,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cardSelected: { borderColor: Colors.brand, backgroundColor: Colors.brandSoft },
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSelected: { backgroundColor: Colors.brand },
  flex: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
});
