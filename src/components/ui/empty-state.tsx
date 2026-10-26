import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors } from '@/constants/theme';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  text?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, text, action }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={34} color={Colors.brand} />
      </View>
      <T variant="h2" style={styles.center}>
        {title}
      </T>
      {text ? (
        <T color={Colors.textMuted} style={styles.center}>
          {text}
        </T>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, flexGrow: 1 },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  center: { textAlign: 'center' },
});
