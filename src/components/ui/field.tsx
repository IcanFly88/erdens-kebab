import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors, Fonts, Radius } from '@/constants/theme';

type Props = TextInputProps & { label: string; error?: string | null };

export function Field({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <T variant="smallStrong" color={Colors.textMuted}>
        {label}
      </T>
      <TextInput
        placeholderTextColor={Colors.textFaint}
        {...rest}
        style={[styles.input, rest.multiline && styles.multiline, error && styles.inputError, style]}
      />
      {error ? (
        <T variant="small" color={Colors.danger}>
          {error}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSoft,
    paddingHorizontal: 14,
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
  },
  multiline: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  inputError: { borderColor: Colors.danger, backgroundColor: Colors.dangerSoft },
});
