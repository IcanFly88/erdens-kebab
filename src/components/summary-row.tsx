import { StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors } from '@/constants/theme';

type Props = { label: string; value: string; strong?: boolean };

export function SummaryRow({ label, value, strong }: Props) {
  return (
    <View style={styles.row}>
      <T
        variant={strong ? 'h3' : 'body'}
        color={strong ? Colors.ink : Colors.textMuted}
        style={styles.label}>
        {label}
      </T>
      <T variant={strong ? 'h3' : 'bodyStrong'}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  label: { flexShrink: 1 },
});
