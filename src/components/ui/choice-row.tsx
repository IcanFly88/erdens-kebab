import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors } from '@/constants/theme';

type Props = {
  label: string;
  sublabel?: string;
  trailing?: ReactNode;
  selected: boolean;
  kind: 'radio' | 'check';
  disabled?: boolean;
  onPress: () => void;
};

export function ChoiceRow({ label, sublabel, trailing, selected, kind, disabled, onPress }: Props) {
  const icon =
    kind === 'radio'
      ? selected
        ? 'radio-button-on'
        : 'radio-button-off'
      : selected
        ? 'checkbox'
        : 'square-outline';
  return (
    <Pressable
      accessibilityRole={kind === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}>
      <Ionicons name={icon} size={22} color={selected ? Colors.brand : Colors.textFaint} />
      <View style={styles.text}>
        <T variant={selected ? 'bodyStrong' : 'body'}>{label}</T>
        {sublabel ? (
          <T variant="small" color={Colors.textMuted}>
            {sublabel}
          </T>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  text: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
});
