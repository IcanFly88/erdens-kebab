// Erdens Kebab arculat: fekete + bronz (#8D7250), Montserrat betűtípus (erdenskebap.hu alapján).

export const Colors = {
  brand: '#8D7250',
  brandDark: '#6F5838',
  brandSoft: '#F5EFE7',
  ink: '#0D0D0D',
  text: '#1B1B1B',
  textMuted: '#6E6A65',
  textFaint: '#A19C95',
  bg: '#FFFFFF',
  bgSoft: '#F7F5F2',
  border: '#ECE7E0',
  success: '#2F8F5B',
  successSoft: '#E7F4EC',
  danger: '#C2410C',
  dangerSoft: '#FDEEE7',
  white: '#FFFFFF',
} as const;

export const Fonts = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
} as const;

export const Radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const Shadow = {
  card: '0 4px 16px rgba(0, 0, 0, 0.08)',
  floating: '0 8px 24px rgba(0, 0, 0, 0.18)',
} as const;
