import { StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors, Radius } from '@/constants/theme';
import type { OpenStatus } from '@/lib/hours';

export function OpenBadge({ status }: { status: OpenStatus }) {
  const color = status.open ? Colors.success : Colors.danger;
  return (
    <View style={[styles.wrap, { backgroundColor: status.open ? Colors.successSoft : Colors.dangerSoft }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <T variant="smallStrong" color={color}>
        {status.label}
      </T>
      {status.detail ? (
        <T variant="small" color={color}>
          · {status.detail}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
