import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors, Radius } from '@/constants/theme';

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  /** Ha 1-nél a mínusz helyett kuka ikon jelenjen meg (törlés). */
  trashAtOne?: boolean;
  size?: 'sm' | 'md';
};

export function Stepper({ value, onChange, min = 1, trashAtOne, size = 'md' }: Props) {
  const dim = size === 'sm' ? 30 : 40;
  const showTrash = trashAtOne && value <= 1;
  return (
    <View style={[styles.wrap, { height: dim }]}>
      <Pressable
        accessibilityLabel={showTrash ? 'Törlés' : 'Csökkentés'}
        hitSlop={6}
        disabled={!trashAtOne && value <= min}
        onPress={() => onChange(value - 1)}
        style={[styles.btn, { width: dim, height: dim }, !trashAtOne && value <= min && styles.off]}>
        <Ionicons
          name={showTrash ? 'trash-outline' : 'remove'}
          size={size === 'sm' ? 16 : 20}
          color={Colors.ink}
        />
      </Pressable>
      <T variant={size === 'sm' ? 'smallStrong' : 'bodyStrong'} style={styles.value}>
        {value}
      </T>
      <Pressable
        accessibilityLabel="Növelés"
        hitSlop={6}
        onPress={() => onChange(value + 1)}
        style={[styles.btn, { width: dim, height: dim }]}>
        <Ionicons name="add" size={size === 'sm' ? 16 : 20} color={Colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  btn: { alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.3 },
  value: { minWidth: 22, textAlign: 'center' },
});
