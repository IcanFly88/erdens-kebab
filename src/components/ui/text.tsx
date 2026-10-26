import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'smallStrong'
  | 'caption';

type Props = TextProps & { variant?: TextVariant; color?: string };

export function T({ variant = 'body', color = Colors.text, style, ...rest }: Props) {
  return <Text {...rest} style={[styles[variant], { color }, style]} />;
}

const styles = StyleSheet.create({
  display: { fontFamily: Fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: 0.5 },
  h1: { fontFamily: Fonts.bold, fontSize: 26, lineHeight: 32 },
  h2: { fontFamily: Fonts.bold, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: Fonts.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
});
