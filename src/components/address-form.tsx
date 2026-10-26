import { Pressable, StyleSheet, View } from 'react-native';

import { Field } from '@/components/ui/field';
import { T } from '@/components/ui/text';
import { Colors, Radius } from '@/constants/theme';
import type { Location } from '@/data/locations';
import { formatPrice } from '@/lib/format';
import type { Address } from '@/lib/order-status';

type Props = {
  location: Location;
  value: Address;
  onChange: (address: Address) => void;
  streetError?: string | null;
};

export function AddressForm({ location, value, onChange, streetError }: Props) {
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <View style={styles.wrap}>
      <View style={styles.townBlock}>
        <T variant="smallStrong" color={Colors.textMuted}>
          Település
        </T>
        <View style={styles.towns}>
          {location.deliveryZones.map((z) => {
            const active = z.town === value.town;
            return (
              <Pressable
                key={z.town}
                onPress={() => set({ town: z.town })}
                style={[styles.town, active && styles.townActive]}>
                <T variant="smallStrong" color={active ? Colors.white : Colors.text}>
                  {z.town}
                </T>
                <T variant="caption" color={active ? Colors.white : Colors.textMuted}>
                  {formatPrice(z.fee)}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Field
        label="Utca, házszám"
        placeholder="pl. Petőfi Sándor u. 12."
        value={value.street}
        onChangeText={(street) => set({ street })}
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        error={streetError}
      />
      <Field
        label="Emelet, ajtó, kapucsengő (nem kötelező)"
        placeholder="pl. 2. em. 5., csengő: Kovács"
        value={value.details}
        onChangeText={(details) => set({ details })}
      />
      <Field
        label="Üzenet a futárnak (nem kötelező)"
        placeholder="pl. a kapu mellett hívj fel"
        value={value.courierNote}
        onChangeText={(courierNote) => set({ courierNote })}
      />
    </View>
  );
}

export function formatAddress(a: Address): string {
  return [`${a.town}, ${a.street}`.trim(), a.details].filter(Boolean).join(' · ');
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  townBlock: { gap: 8 },
  towns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  town: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  townActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
});
