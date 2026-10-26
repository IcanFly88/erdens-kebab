import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors, Radius, Shadow } from '@/constants/theme';
import type { MenuItem } from '@/data/menu';
import { formatPrice } from '@/lib/format';

type Props = {
  item: MenuItem;
  qtyInCart: number;
  onPress: () => void;
  onAdd: () => void;
};

export function MenuItemRow({ item, qtyInCart, onPress, onAdd }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatPrice(item.price)}`}>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          {qtyInCart > 0 ? (
            <View style={styles.qtyBadge}>
              <T variant="caption" color={Colors.white}>
                {qtyInCart}×
              </T>
            </View>
          ) : null}
          <T variant="h3" numberOfLines={2} style={styles.flex}>
            {item.name}
          </T>
        </View>
        {item.description ? (
          <T variant="small" color={Colors.textMuted} numberOfLines={2}>
            {item.description}
          </T>
        ) : null}
        <View style={styles.metaRow}>
          <T variant="bodyStrong">{formatPrice(item.price)}</T>
          {item.tags?.includes('vega') ? <Tag icon="leaf" label="Vega" color={Colors.success} /> : null}
          {item.tags?.includes('csípős') ? (
            <Tag icon="flame" label="Csípős" color={Colors.danger} />
          ) : null}
          {item.popular ? <Tag icon="star" label="Népszerű" color={Colors.brandDark} /> : null}
        </View>
      </View>
      <View style={styles.imageWrap}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name="fast-food-outline" size={30} color={Colors.brand} />
          </View>
        )}
        <Pressable
          accessibilityLabel={`${item.name} hozzáadása`}
          hitSlop={8}
          onPress={onAdd}
          style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
          <Ionicons name="add" size={22} color={Colors.ink} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function Tag({
  icon,
  label,
  color,
}: {
  icon: 'leaf' | 'flame' | 'star';
  label: string;
  color: string;
}) {
  return (
    <View style={styles.tag}>
      <Ionicons name={icon} size={11} color={color} />
      <T variant="caption" color={color}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  pressed: { backgroundColor: Colors.bgSoft },
  text: { flex: 1, gap: 6 },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBadge: {
    backgroundColor: Colors.brand,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.bgSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  imageWrap: { width: 104, height: 104 },
  image: { width: 104, height: 104, borderRadius: Radius.md, backgroundColor: Colors.bgSoft },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandSoft },
  add: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: Shadow.card,
  },
  addPressed: { transform: [{ scale: 0.92 }] },
});
