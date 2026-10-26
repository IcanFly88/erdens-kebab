import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors, Radius, Shadow } from '@/constants/theme';

type Option<V extends string> = {
  value: V;
  label: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
};

type Props<V extends string> = {
  options: Option<V>[];
  value: V;
  onChange: (value: V) => void;
};

export function Segmented<V extends string>({ options, value, onChange }: Props<V>) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.option, active && styles.active]}>
            {o.icon ? (
              <Ionicons name={o.icon} size={16} color={active ? Colors.ink : Colors.textMuted} />
            ) : null}
            <T variant="smallStrong" color={active ? Colors.ink : Colors.textMuted}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: Colors.border,
    borderRadius: Radius.pill,
    padding: 4,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: Radius.pill,
  },
  active: { backgroundColor: Colors.bg, boxShadow: Shadow.card },
});
