import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors, Radius, Shadow } from '@/constants/theme';
import type { MenuItem } from '@/data/menu';
import { formatPrice } from '@/lib/format';

type Props = {
  item: MenuItem;
  onPress: () => void;
  onAdd: () => void;
  width?: number;
};

export function PopularCard({ item, onPress, onAdd, width = 156 }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}>
      <View>
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={[styles.image, { width }]}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.image, styles.placeholder, { width }]}>
            <Ionicons name="fast-food-outline" size={28} color={Colors.brand} />
          </View>
        )}
        <Pressable
          accessibilityLabel={`${item.name} hozzáadása`}
          hitSlop={8}
          onPress={onAdd}
          style={styles.add}>
          <Ionicons name="add" size={20} color={Colors.ink} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <T variant="smallStrong" numberOfLines={2}>
          {item.name}
        </T>
        <T variant="small" color={Colors.textMuted}>
          {formatPrice(item.price)}
        </T>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  pressed: { opacity: 0.8 },
  image: { height: 112, borderRadius: Radius.md, backgroundColor: Colors.bgSoft },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandSoft },
  add: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: Shadow.card,
  },
  body: { gap: 2, paddingHorizontal: 2 },
});
