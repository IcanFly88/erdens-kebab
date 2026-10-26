import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddressForm } from '@/components/address-form';
import { Button } from '@/components/ui/button';
import { Card, Divider } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { T } from '@/components/ui/text';
import { Colors } from '@/constants/theme';
import { RESTAURANT } from '@/data/locations';
import { useStatusBarStyle } from '@/lib/use-status-bar';
import { useApp } from '@/store/app-store';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, address, location, dispatch } = useApp();
  const [draft, setDraft] = useState(profile);
  const [addressDraft, setAddressDraft] = useState(address);

  // Ha máshol (pl. a pénztárban) frissül a profil vagy a cím, a szerkesztő is kövesse.
  const [synced, setSynced] = useState({ profile, address });
  if (synced.profile !== profile || synced.address !== address) {
    setSynced({ profile, address });
    setDraft(profile);
    setAddressDraft(address);
  }

  useStatusBarStyle('dark');

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(profile) ||
    JSON.stringify(addressDraft) !== JSON.stringify(address);

  const save = () => {
    dispatch({ type: 'setProfile', profile: draft });
    dispatch({ type: 'setAddress', address: addressDraft });
  };

  const initials =
    draft.name
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase())
      .slice(0, 2)
      .join('') || '?';

  const confirmReset = () =>
    Alert.alert('Adatok törlése', 'Törlöd a kosarat, a mentett adatokat és a rendelési előzményeket?', [
      { text: 'Mégse', style: 'cancel' },
      { text: 'Törlés', style: 'destructive', onPress: () => dispatch({ type: 'reset' }) },
    ]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <T variant="h2" color={Colors.white}>
            {initials}
          </T>
        </View>
        <View style={styles.flex}>
          <T variant="h1">{profile.name || 'Szia!'}</T>
          <T variant="small" color={Colors.textMuted}>
            {profile.phone || 'Add meg az adataid a gyorsabb rendeléshez'}
          </T>
        </View>
      </View>

      <Card title="Személyes adatok">
        <View style={styles.form}>
          <Field
            label="Név"
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            placeholder="Teljes név"
            autoComplete="name"
            textContentType="name"
          />
          <Field
            label="Telefonszám"
            value={draft.phone}
            onChangeText={(phone) => setDraft({ ...draft, phone })}
            placeholder="+36 30 123 4567"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <Field
            label="E-mail (nem kötelező)"
            value={draft.email}
            onChangeText={(email) => setDraft({ ...draft, email })}
            placeholder="nev@email.hu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
        </View>
      </Card>

      <Card title="Szállítási cím">
        <AddressForm location={location} value={addressDraft} onChange={setAddressDraft} />
      </Card>

      {dirty ? <Button title="Mentés" onPress={save} /> : null}

      <Card>
        <LinkRow
          icon="storefront-outline"
          label="Kiválasztott étterem"
          value={location.city}
          onPress={() => router.push('/location')}
        />
        <Divider />
        <LinkRow
          icon="time-outline"
          label="Nyitvatartás és elérhetőség"
          onPress={() => router.push('/info')}
        />
        <Divider />
        <LinkRow
          icon="globe-outline"
          label="Weboldal"
          value="erdenskebap.hu"
          onPress={() => Linking.openURL(RESTAURANT.website)}
        />
        <Divider />
        <LinkRow
          icon="logo-tiktok"
          label="TikTok"
          value="@erdenskebab"
          onPress={() => Linking.openURL(RESTAURANT.tiktok)}
        />
      </Card>

      <Card>
        <LinkRow icon="trash-outline" label="Adataim törlése" danger onPress={confirmReset} />
      </Card>

      <T variant="small" color={Colors.textFaint} style={styles.footer}>
        Erdens Kebab · v{Constants.expoConfig?.version ?? '1.0.0'}
      </T>
    </ScrollView>
  );
}

function LinkRow({
  icon,
  label,
  value,
  danger,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const color = danger ? Colors.danger : Colors.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={danger ? Colors.danger : Colors.brand} />
      <T variant="bodyStrong" color={color} style={styles.flex}>
        {label}
      </T>
      {value ? (
        <T variant="small" color={Colors.textMuted}>
          {value}
        </T>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgSoft },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  form: { gap: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  pressed: { opacity: 0.6 },
  footer: { textAlign: 'center', marginTop: 8 },
});
