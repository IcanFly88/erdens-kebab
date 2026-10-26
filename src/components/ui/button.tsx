import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors, Radius } from '@/constants/theme';

type Variant = 'primary' | 'dark' | 'outline' | 'ghost';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  left?: ReactNode;
  /** Jobbra igazított kiegészítő szöveg, pl. ár. */
  trailing?: string;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

const PALETTE: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: Colors.brand, fg: Colors.white },
  dark: { bg: Colors.ink, fg: Colors.white },
  outline: { bg: Colors.bg, fg: Colors.ink, border: Colors.border },
  ghost: { bg: 'transparent', fg: Colors.brandDark },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  left,
  trailing,
  size = 'lg',
  style,
}: Props) {
  const p = PALETTE[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        { backgroundColor: p.bg, borderColor: p.border ?? p.bg, borderWidth: p.border ? 1 : 0 },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      {left}
      <T
        variant={size === 'lg' ? 'bodyStrong' : 'smallStrong'}
        color={p.fg}
        style={trailing ? styles.grow : undefined}>
        {title}
      </T>
      {trailing ? (
        <View>
          <T variant={size === 'lg' ? 'bodyStrong' : 'smallStrong'} color={p.fg}>
            {trailing}
          </T>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: Radius.md,
  },
  lg: { minHeight: 54, paddingHorizontal: 20 },
  md: { minHeight: 40, paddingHorizontal: 14 },
  grow: { flex: 1 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
