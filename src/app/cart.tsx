import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PopularCard } from '@/components/popular-card';
import { SummaryRow } from '@/components/summary-row';
import { Button } from '@/components/ui/button';
import { Card, Divider } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Segmented } from '@/components/ui/segmented';
import { Stepper } from '@/components/ui/stepper';
import { T } from '@/components/ui/text';
import { Colors, Radius } from '@/constants/theme';
import { describeSelections, getItem, unitPrice } from '@/data/menu';
import { formatPrice } from '@/lib/format';
import { openProduct, useQuickAdd } from '@/lib/use-quick-add';
import { useStatusBarStyle } from '@/lib/use-status-bar';
import { deliveryZone, useApp } from '@/store/app-store';

const UPSELL_IDS = ['ropogos-nuggets', 'ropogos-sajt', 'ropogos-chili-cheese', 'pita-falafel'];

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { cart, location, mode, address, subtotal, dispatch } = useApp();
  const quickAdd = useQuickAdd();
  useStatusBarStyle('dark');

  const zone = deliveryZone(location, address.town);
  const deliveryFee = mode === 'delivery' ? zone.fee : 0;
  const missingForMin = mode === 'delivery' ? Math.max(location.minOrder - subtotal, 0) : 0;
  const upsell = UPSELL_IDS.map(getItem).filter(
    (item) => item && !cart.some((l) => l.itemId === item.id),
  ) as NonNullable<ReturnType<typeof getItem>>[];

  const confirmClear = () =>
    Alert.alert('Kosár ürítése', 'Biztosan törlöd a kosár teljes tartalmát?', [
      { text: 'Mégse', style: 'cancel' },
      { text: 'Ürítés', style: 'destructive', onPress: () => dispatch({ type: 'clearCart' }) },
    ]);

  if (cart.length === 0) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerRight: () => null }} />
        <EmptyState
          icon="bag-outline"
          title="A kosarad üres"
          text="Nézz körül az étlapon – a Kebab tál és a Feta dürüm a vendégek kedvence."
          action={<Button title="Vissza az étlaphoz" onPress={() => router.back()} style={styles.cta} />}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable hitSlop={10} onPress={confirmClear}>
              <T variant="smallStrong" color={Colors.brandDark}>
                Ürítés
              </T>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.storeRow}>
            <View style={styles.storeIcon}>
              <Ionicons name="storefront" size={18} color={Colors.brand} />
            </View>
            <View style={styles.flex}>
              <T variant="h3">{location.name}</T>
              <T variant="small" color={Colors.textMuted}>
                {location.address}
              </T>
            </View>
          </View>
          <View style={styles.modeWrap}>
            <Segmented
              value={mode}
              onChange={(m) => dispatch({ type: 'setMode', mode: m })}
              options={[
                { value: 'delivery', label: 'Kiszállítás', icon: 'bicycle' },
                { value: 'pickup', label: 'Elvitel', icon: 'bag-handle-outline' },
              ]}
            />
          </View>
        </Card>

        <Card title="Rendelésed">
          {cart.map((line, i) => {
            const item = getItem(line.itemId);
            if (!item) return null;
            const summary = describeSelections(item, line.selections);
            return (
              <View key={line.key}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.line}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Ionicons name="fast-food-outline" size={20} color={Colors.brand} />
                    </View>
                  )}
                  <Pressable
                    style={styles.flex}
                    onPress={() =>
                      router.push({
                        pathname: '/product/[id]',
                        params: { id: item.id, line: line.key },
                      })
                    }>
                    <T variant="bodyStrong">{item.name}</T>
                    {summary ? (
                      <T variant="small" color={Colors.textMuted}>
                        {summary}
                      </T>
                    ) : null}
                    {line.note ? (
                      <T variant="small" color={Colors.textMuted}>
                        „{line.note}”
                      </T>
                    ) : null}
                    <T variant="smallStrong" style={styles.linePrice}>
                      {formatPrice(unitPrice(item, line.selections) * line.qty)}
                    </T>
                  </Pressable>
                  <Stepper
                    size="sm"
                    trashAtOne
                    value={line.qty}
                    onChange={(next) =>
                      dispatch({ type: 'changeQty', key: line.key, delta: next - line.qty })
                    }
                  />
                </View>
              </View>
            );
          })}
          <Pressable onPress={() => router.back()} style={styles.addMore}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.brandDark} />
            <T variant="smallStrong" color={Colors.brandDark}>
              További tételek hozzáadása
            </T>
          </Pressable>
        </Card>

        {upsell.length ? (
          <View style={styles.upsell}>
            <T variant="h3" style={styles.upsellTitle}>
              Ajánljuk még mellé
            </T>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.upsellList}>
              {upsell.map((item) => (
                <PopularCard
                  key={item.id}
                  item={item}
                  width={128}
                  onPress={() => openProduct(item)}
                  onAdd={() => quickAdd(item)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Card title="Összesítő">
          <SummaryRow label="Részösszeg" value={formatPrice(subtotal)} />
          {mode === 'delivery' ? (
            <SummaryRow label={`Szállítási díj (${zone.town})`} value={formatPrice(deliveryFee)} />
          ) : (
            <SummaryRow label="Elvitel az étteremből" value="ingyenes" />
          )}
          <Divider />
          <SummaryRow label="Összesen" value={formatPrice(subtotal + deliveryFee)} strong />
        </Card>

        {missingForMin > 0 ? (
          <View style={styles.minNotice}>
            <Ionicons name="information-circle" size={18} color={Colors.brandDark} />
            <T variant="small" color={Colors.brandDark} style={styles.flex}>
              Kiszállításnál a minimális rendelési érték {formatPrice(location.minOrder)}. Még{' '}
              {formatPrice(missingForMin)} hiányzik – vagy válaszd az elvitelt.
            </T>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          title="Tovább a pénztárhoz"
          trailing={formatPrice(subtotal + deliveryFee)}
          disabled={missingForMin > 0}
          onPress={() => router.push('/checkout')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgSoft },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  cta: { alignSelf: 'stretch', marginTop: 8 },
  flex: { flex: 1 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeWrap: { marginTop: 14 },
  line: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: Radius.sm, backgroundColor: Colors.bgSoft },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandSoft },
  linePrice: { marginTop: 4 },
  addMore: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12 },
  upsell: { marginHorizontal: -16 },
  upsellTitle: { paddingHorizontal: 16, marginBottom: 10 },
  upsellList: { paddingHorizontal: 16, gap: 12 },
  minNotice: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.brandSoft,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
