import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { formatPrice } from '@/lib/format';
import { useApp } from '@/store/app-store';

/** Lebegő "Kosár megtekintése" sáv az étlap és a keresés alján. */
export function CartBar() {
  const { cartCount, subtotal } = useApp();
  if (cartCount === 0) return null;
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/cart')}
        style={({ pressed }) => [styles.bar, pressed && styles.pressed]}>
        <View style={styles.count}>
          <T variant="smallStrong" color={Colors.brand}>
            {cartCount}
          </T>
        </View>
        <T variant="bodyStrong" color={Colors.white} style={styles.label}>
          Kosár megtekintése
        </T>
        <T variant="bodyStrong" color={Colors.white}>
          {formatPrice(subtotal)}
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 12, pointerEvents: 'box-none' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.brand,
    boxShadow: Shadow.floating,
  },
  pressed: { backgroundColor: Colors.brandDark },
  count: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 6,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
