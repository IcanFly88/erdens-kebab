import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddressForm } from '@/components/address-form';
import { SummaryRow } from '@/components/summary-row';
import { Button } from '@/components/ui/button';
import { Card, Divider } from '@/components/ui/card';
import { ChoiceRow } from '@/components/ui/choice-row';
import { Field } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { T } from '@/components/ui/text';
import { Colors, Radius } from '@/constants/theme';
import { formatDay, formatPrice, formatRange, formatTime } from '@/lib/format';
import { closingTime, isOpenAt, scheduleSlots } from '@/lib/hours';
import { api } from '@/lib/api';
import { PAYMENT_LABELS, type PaymentMethod } from '@/lib/order-status';
import { useNow } from '@/lib/use-now';
import { useRestaurantStatus } from '@/lib/use-restaurant-status';
import { useStatusBarStyle } from '@/lib/use-status-bar';
import { deliveryZone, useApp } from '@/store/app-store';

const TIPS = [0, 200, 400, 600];
const PAYMENTS: { id: PaymentMethod; icon: 'cash-outline' | 'card-outline' | 'wallet-outline' }[] = [
  { id: 'cash', icon: 'cash-outline' },
  { id: 'card', icon: 'card-outline' },
  { id: 'szep', icon: 'wallet-outline' },
];

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const app = useApp();
  const { location, mode, cart, subtotal, dispatch } = app;
  const now = useNow();
  useStatusBarStyle('dark');

  const [address, setAddress] = useState(app.address);
  const [name, setName] = useState(app.profile.name);
  const [phone, setPhone] = useState(app.profile.phone);
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [tip, setTip] = useState(0);
  const [cutlery, setCutlery] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slow, setSlow] = useState(false);
  const restaurant = useRestaurantStatus(location.id);
  const paused = restaurant?.paused === true;

  const zone = deliveryZone(location, address.town);
  const eta = mode === 'delivery' ? zone.eta : location.pickupEta;
  const nowDate = new Date(now);
  const close = closingTime(location, nowDate);
  const asapAvailable =
    isOpenAt(location, nowDate) && !!close && close.getTime() - now > 20 * 60_000;
  const slots = scheduleSlots(location, nowDate, eta[1]);
  const [when, setWhen] = useState<'asap' | number | null>(
    asapAvailable ? 'asap' : (slots[0]?.getTime() ?? null),
  );

  const deliveryFee = mode === 'delivery' ? zone.fee : 0;
  const tipAmount = mode === 'delivery' ? tip : 0;
  const total = subtotal + deliveryFee + tipAmount;

  const errors = {
    street: mode === 'delivery' && !address.street.trim() ? 'Add meg az utcát és a házszámot.' : null,
    name: !name.trim() ? 'Add meg a neved.' : null,
    phone: phone.replace(/\D/g, '').length < 9 ? 'Adj meg egy érvényes telefonszámot.' : null,
    when: when === null || (when === 'asap' && !asapAvailable) ? 'Válassz átvételi időpontot.' : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const shown = (e: string | null) => (attempted ? e : null);

  const placeOrder = async () => {
    setAttempted(true);
    if (!valid || cart.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Hiányzó adatok', Object.values(errors).filter(Boolean).join('\n'));
      return;
    }
    setSubmitting(true);
    const slowTimer = setTimeout(() => setSlow(true), 5_000);
    try {
      // Az árakat a szerver a saját étlapja alapján újraszámolja.
      const order = await api.createOrder({
        locationId: location.id,
        mode,
        lines: cart.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          selections: l.selections,
          note: l.note,
        })),
        contact: { name: name.trim(), phone: phone.trim() },
        address: mode === 'delivery' ? address : undefined,
        payment,
        tip: tipAmount,
        cutlery,
        scheduledFor: when === 'asap' ? null : when,
        pushToken: app.pushToken,
      });
      dispatch({
        type: 'setProfile',
        profile: { ...app.profile, name: name.trim(), phone: phone.trim() },
      });
      if (mode === 'delivery') dispatch({ type: 'setAddress', address });
      dispatch({ type: 'placeOrder', order });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.dismissAll();
      router.push({ pathname: '/order/[id]', params: { id: order.id } });
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Nem sikerült leadni a rendelést', (err as Error).message);
    } finally {
      clearTimeout(slowTimer);
      setSubmitting(false);
      setSlow(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        {paused ? (
          <View style={styles.paused}>
            <Ionicons name="pause-circle" size={20} color={Colors.danger} />
            <T variant="small" color={Colors.danger} style={styles.flex}>
              Az étterem most nem fogad online rendelést. Hívd őket telefonon: {location.phone}
            </T>
          </View>
        ) : null}

        <Segmented
          value={mode}
          onChange={(m) => dispatch({ type: 'setMode', mode: m })}
          options={[
            { value: 'delivery', label: 'Kiszállítás', icon: 'bicycle' },
            { value: 'pickup', label: 'Elvitel', icon: 'bag-handle-outline' },
          ]}
        />

        {mode === 'delivery' ? (
          <Card title="Szállítási cím">
            <AddressForm
              location={location}
              value={address}
              onChange={setAddress}
              streetError={shown(errors.street)}
            />
          </Card>
        ) : (
          <Card title="Átvétel helye">
            <View style={styles.pickupRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="storefront" size={18} color={Colors.brand} />
              </View>
              <View style={styles.flex}>
                <T variant="bodyStrong">{location.name}</T>
                <T variant="small" color={Colors.textMuted}>
                  {location.address}
                </T>
              </View>
              <Button
                title="Térkép"
                size="md"
                variant="outline"
                onPress={() => Linking.openURL(location.mapsUrl)}
              />
            </View>
          </Card>
        )}

        <Card title={mode === 'delivery' ? 'Mikor kéred?' : 'Mikor viszed el?'}>
          <ChoiceRow
            kind="radio"
            label="Mielőbb"
            sublabel={
              asapAvailable
                ? `${formatRange(eta)} múlva`
                : 'Az étterem most zárva, csak előrendelés lehetséges'
            }
            selected={when === 'asap'}
            disabled={!asapAvailable}
            onPress={() => setWhen('asap')}
          />
          <Divider />
          <ChoiceRow
            kind="radio"
            label="Időpontra"
            sublabel={
              typeof when === 'number'
                ? `${capitalize(formatDay(when, now))} ${formatTime(when)}`
                : 'Válassz időpontot'
            }
            selected={typeof when === 'number'}
            disabled={slots.length === 0}
            onPress={() => slots[0] && setWhen(slots[0].getTime())}
          />
          {typeof when === 'number' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.slots}>
              {slots.map((slot) => {
                const t = slot.getTime();
                const active = t === when;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setWhen(t)}
                    style={[styles.slot, active && styles.slotActive]}>
                    <T variant="caption" color={active ? Colors.white : Colors.textMuted}>
                      {capitalize(formatDay(t, now))}
                    </T>
                    <T variant="smallStrong" color={active ? Colors.white : Colors.text}>
                      {formatTime(t)}
                    </T>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          {shown(errors.when) ? (
            <T variant="small" color={Colors.danger}>
              {errors.when}
            </T>
          ) : null}
        </Card>

        <Card title="Elérhetőség">
          <View style={styles.form}>
            <Field
              label="Név"
              value={name}
              onChangeText={setName}
              placeholder="Teljes név"
              autoComplete="name"
              textContentType="name"
              error={shown(errors.name)}
            />
            <Field
              label="Telefonszám"
              value={phone}
              onChangeText={setPhone}
              placeholder="+36 30 123 4567"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              error={shown(errors.phone)}
            />
          </View>
        </Card>

        <Card title="Fizetés">
          {PAYMENTS.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <Divider /> : null}
              <ChoiceRow
                kind="radio"
                label={PAYMENT_LABELS[p.id]}
                selected={payment === p.id}
                onPress={() => setPayment(p.id)}
                trailing={<Ionicons name={p.icon} size={20} color={Colors.textMuted} />}
              />
            </View>
          ))}
          <Divider />
          <ChoiceRow
            kind="radio"
            label="Online bankkártya"
            sublabel="Hamarosan"
            selected={false}
            disabled
            onPress={() => {}}
            trailing={<Ionicons name="lock-closed-outline" size={18} color={Colors.textFaint} />}
          />
        </Card>

        {mode === 'delivery' ? (
          <Card title="Borravaló a futárnak">
            <T variant="small" color={Colors.textMuted}>
              A borravaló teljes egészében a futárodhoz kerül.
            </T>
            <View style={styles.tips}>
              {TIPS.map((t) => {
                const active = t === tip;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setTip(t)}
                    style={[styles.tip, active && styles.tipActive]}>
                    <T variant="smallStrong" color={active ? Colors.white : Colors.text}>
                      {t === 0 ? 'Most nem' : formatPrice(t)}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}

        <Card>
          <View style={styles.switchRow}>
            <Ionicons name="restaurant-outline" size={20} color={Colors.brand} />
            <View style={styles.flex}>
              <T variant="bodyStrong">Kérek evőeszközt</T>
              <T variant="small" color={Colors.textMuted}>
                Csak ha tényleg szükséged van rá 🌱
              </T>
            </View>
            <Switch
              value={cutlery}
              onValueChange={setCutlery}
              trackColor={{ true: Colors.brand, false: Colors.border }}
              thumbColor={Colors.white}
            />
          </View>
        </Card>

        <Card title="Összesítő">
          <SummaryRow
            label={`Részösszeg (${cart.reduce((n, l) => n + l.qty, 0)} tétel)`}
            value={formatPrice(subtotal)}
          />
          {mode === 'delivery' ? (
            <>
              <SummaryRow label={`Szállítási díj (${zone.town})`} value={formatPrice(deliveryFee)} />
              {tipAmount ? <SummaryRow label="Borravaló" value={formatPrice(tipAmount)} /> : null}
            </>
          ) : null}
          <Divider />
          <SummaryRow label="Fizetendő" value={formatPrice(total)} strong />
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {slow ? (
          <T variant="small" color={Colors.textMuted} style={styles.slow}>
            A rendelési rendszer épp indul – ez akár egy percig is tarthat…
          </T>
        ) : null}
        <Button
          title={submitting ? 'Küldés…' : 'Rendelés leadása'}
          trailing={formatPrice(total)}
          onPress={placeOrder}
          disabled={submitting || paused}
        />
      </View>
    </View>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgSoft },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  flex: { flex: 1 },
  form: { gap: 14 },
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slots: { gap: 8, paddingVertical: 8 },
  slot: {
    width: 74,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 2,
  },
  slotActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  tips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tip: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slow: { textAlign: 'center', marginBottom: 8 },
  paused: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
