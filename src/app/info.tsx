import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { OpenBadge } from '@/components/open-badge';
import { Button } from '@/components/ui/button';
import { Card, Divider } from '@/components/ui/card';
import { T } from '@/components/ui/text';
import { Colors } from '@/constants/theme';
import { LOCATIONS, RESTAURANT } from '@/data/locations';
import { DAY_NAMES, formatPrice, formatRange } from '@/lib/format';
import { hoursLabel, openStatus } from '@/lib/hours';
import { useNow } from '@/lib/use-now';
import { useStatusBarStyle } from '@/lib/use-status-bar';

// Hétfővel kezdődő sorrend a nyitvatartás táblázathoz.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export default function InfoScreen() {
  const now = new Date(useNow());
  useStatusBarStyle('dark');

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <T variant="display" style={styles.wordmark}>
          {RESTAURANT.name.toUpperCase()}
        </T>
        <T color={Colors.textMuted}>
          Török kebab Monoron és Vecsésen: pita, tortilla, tál és box – csirke- vagy borjúhússal,
          illetve falafellel.
        </T>
      </View>

      {LOCATIONS.map((loc) => (
        <Card key={loc.id} title={loc.name} right={<OpenBadge status={openStatus(loc, now)} />}>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={18} color={Colors.brand} />
            <T style={styles.flex}>{loc.address}</T>
          </View>
          <View style={styles.row}>
            <Ionicons name="call-outline" size={18} color={Colors.brand} />
            <T style={styles.flex}>{loc.phone}</T>
          </View>

          <View style={styles.actions}>
            <Button
              title="Hívás"
              size="md"
              variant="outline"
              left={<Ionicons name="call" size={16} color={Colors.ink} />}
              onPress={() => Linking.openURL(`tel:${loc.phone.replace(/\s/g, '')}`)}
              style={styles.flex}
            />
            <Button
              title="Útvonal"
              size="md"
              variant="outline"
              left={<Ionicons name="navigate" size={16} color={Colors.ink} />}
              onPress={() => Linking.openURL(loc.mapsUrl)}
              style={styles.flex}
            />
          </View>

          <Divider />
          <T variant="smallStrong" style={styles.blockTitle}>
            Nyitvatartás
          </T>
          {WEEK.map((d) => {
            const isToday = d === now.getDay();
            return (
              <View key={d} style={styles.hourRow}>
                <T variant={isToday ? 'smallStrong' : 'small'} color={isToday ? Colors.ink : Colors.textMuted}>
                  {DAY_NAMES[d].charAt(0).toUpperCase() + DAY_NAMES[d].slice(1)}
                </T>
                <T variant={isToday ? 'smallStrong' : 'small'} color={isToday ? Colors.ink : Colors.textMuted}>
                  {hoursLabel(loc, d)}
                </T>
              </View>
            );
          })}

          <Divider />
          <T variant="smallStrong" style={styles.blockTitle}>
            Kiszállítási területek
          </T>
          {loc.deliveryZones.map((z) => (
            <View key={z.town} style={styles.hourRow}>
              <T variant="small" color={Colors.textMuted}>
                {z.town}
              </T>
              <T variant="small" color={Colors.textMuted}>
                {formatPrice(z.fee)} · {formatRange(z.eta)}
              </T>
            </View>
          ))}
          <T variant="caption" color={Colors.textFaint} style={styles.minOrder}>
            Minimális rendelési érték kiszállításnál: {formatPrice(loc.minOrder)}
          </T>
        </Card>
      ))}

      <Card title="Kövess minket">
        <View style={styles.actions}>
          <Button
            title="Weboldal"
            size="md"
            variant="outline"
            left={<Ionicons name="globe-outline" size={16} color={Colors.ink} />}
            onPress={() => Linking.openURL(RESTAURANT.website)}
            style={styles.flex}
          />
          <Button
            title="TikTok"
            size="md"
            variant="dark"
            left={<Ionicons name="logo-tiktok" size={16} color={Colors.white} />}
            onPress={() => Linking.openURL(RESTAURANT.tiktok)}
            style={styles.flex}
          />
        </View>
      </Card>

      <T variant="small" color={Colors.textFaint} style={styles.footnote}>
        Allergénekkel és összetevőkkel kapcsolatban érdeklődj telefonon az étteremben.
      </T>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgSoft },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  intro: { gap: 6, paddingHorizontal: 4 },
  wordmark: { fontSize: 24, letterSpacing: 1.5 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  blockTitle: { marginTop: 12, marginBottom: 6 },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  minOrder: { marginTop: 8 },
  footnote: { textAlign: 'center', paddingHorizontal: 24 },
});
