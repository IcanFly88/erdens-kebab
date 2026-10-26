import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatAddress } from '@/components/address-form';
import { SummaryRow } from '@/components/summary-row';
import { Button } from '@/components/ui/button';
import { Card, Divider } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { T } from '@/components/ui/text';
import { Colors, Radius } from '@/constants/theme';
import { getLocation } from '@/data/locations';
import { api } from '@/lib/api';
import { formatDayTime, formatPrice, formatTime } from '@/lib/format';
import { setupNotifications } from '@/lib/notifications';
import {
  isFinal,
  PAYMENT_LABELS,
  STEP_LABELS,
  stepIndex,
  stepTimes,
  type Order,
} from '@/lib/order-status';
import { useNow } from '@/lib/use-now';
import { useStatusBarStyle } from '@/lib/use-status-bar';
import { useApp } from '@/store/app-store';

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { orders, pushToken, dispatch } = useApp();
  const now = useNow(1_000);
  const [pulse] = useState(() => new Animated.Value(0));
  useStatusBarStyle('dark');

  const order = orders.find((o) => o.id === id);
  const orderId = order?.id;
  const finished = order ? isFinal(order.status) : true;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Értesítési engedély kérése a követés megnyitásakor; ha van push token, a szerver küldi az értesítéseket.
  useEffect(() => {
    if (!orderId || finished) return;
    setupNotifications()
      .then(({ pushToken: token }) => {
        if (!token) return;
        if (token !== pushToken) dispatch({ type: 'setPushToken', token });
        return api.registerPushToken(orderId, token);
      })
      .catch(() => {});
  }, [orderId, finished, pushToken, dispatch]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!order) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <EmptyState
          icon="alert-circle-outline"
          title="A rendelés nem található"
          action={<Button title="Vissza" onPress={close} />}
        />
      </View>
    );
  }

  const loc = getLocation(order.locationId);
  const steps = STEP_LABELS[order.mode];
  const step = stepIndex(order.status);
  const times = stepTimes(order);
  const isDelivery = order.mode === 'delivery';
  const rejected = order.status === 'rejected';
  const done = order.status === 'completed';
  const { title, subtitle } = headline(order, now);
  const travel = travelFraction(order, now);
  const callRestaurant = () => Linking.openURL(`tel:${loc.phone.replace(/\s/g, '')}`);

  const reorder = () => {
    dispatch({ type: 'reorder', order });
    router.replace('/cart');
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
        ]}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Bezárás" onPress={close} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.ink} />
          </Pressable>
          <T variant="smallStrong" color={Colors.textMuted}>
            Rendelés {order.number}
          </T>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.statusBlock}>
          <T variant="h1">{title}</T>
          <T color={Colors.textMuted}>{subtitle}</T>
        </View>

        {rejected ? (
          <View style={styles.rejected}>
            <Ionicons name="close-circle" size={24} color={Colors.danger} />
            <View style={styles.flex}>
              <T variant="bodyStrong" color={Colors.danger}>
                Az étterem elutasította a rendelést
              </T>
              <T variant="small" color={Colors.danger}>
                {order.rejectReason || 'Kérjük, hívd az éttermet a részletekért.'} Nem kell fizetned semmit.
              </T>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.segments}>
              {[1, 2, 3, 4].map((s) => {
                const filled = step >= s;
                const current = step === s - 1 && !done;
                return (
                  <View key={s} style={styles.segment}>
                    {filled ? <View style={[StyleSheet.absoluteFill, styles.segmentFill]} /> : null}
                    {current ? (
                      <Animated.View
                        style={[StyleSheet.absoluteFill, styles.segmentFill, { opacity: pulse }]}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={styles.route}>
              <View style={styles.track}>
                <View style={styles.routeLine}>
                  <View style={[styles.routeLineFill, { width: `${travel * 100}%` }]} />
                </View>
                <RouteNode icon="storefront" label={loc.city} side="left" />
                <RouteNode
                  icon={isDelivery ? 'home' : 'person'}
                  label={isDelivery ? 'Te' : 'Átvétel'}
                  side="right"
                />
                <View style={[styles.mover, { left: `${travel * 100}%` }]}>
                  <View style={styles.moverIcon}>
                    <Ionicons
                      name={isDelivery ? 'bicycle' : 'bag-handle'}
                      size={18}
                      color={Colors.white}
                    />
                  </View>
                </View>
              </View>
            </View>

            <Card>
              {steps.map((label, i) => {
                const reached = step >= i;
                const current = step === i && !done;
                return (
                  <View key={label} style={styles.stepRow}>
                    <View style={styles.stepRail}>
                      <View
                        style={[
                          styles.stepDot,
                          reached && styles.stepDotDone,
                          current && styles.stepDotCurrent,
                        ]}>
                        {reached && !current ? (
                          <Ionicons name="checkmark" size={12} color={Colors.white} />
                        ) : null}
                      </View>
                      {i < steps.length - 1 ? (
                        <View style={[styles.stepLine, step > i && styles.stepLineDone]} />
                      ) : null}
                    </View>
                    <T
                      variant={current ? 'bodyStrong' : 'body'}
                      color={reached ? Colors.text : Colors.textFaint}
                      style={styles.flex}>
                      {label}
                    </T>
                    {times[i] ? (
                      <T variant="small" color={Colors.textMuted}>
                        {formatTime(times[i])}
                      </T>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          </>
        )}

        <Card title="Részletek">
          <InfoRow icon="storefront-outline" label={loc.name} value={loc.address} />
          {order.address ? (
            <InfoRow
              icon="location-outline"
              label="Szállítási cím"
              value={formatAddress(order.address)}
            />
          ) : null}
          {order.scheduledFor ? (
            <InfoRow
              icon="calendar-outline"
              label="Kért időpont"
              value={formatDayTime(order.scheduledFor, now)}
            />
          ) : null}
          <InfoRow icon="wallet-outline" label="Fizetés" value={PAYMENT_LABELS[order.payment]} />
          <InfoRow
            icon="call-outline"
            label="Elérhetőség"
            value={`${order.contact.name} · ${order.contact.phone}`}
          />
          <View style={styles.actions}>
            <Button
              title="Étterem hívása"
              size="md"
              variant="outline"
              left={<Ionicons name="call" size={16} color={Colors.ink} />}
              onPress={callRestaurant}
              style={styles.flex}
            />
            {!isDelivery ? (
              <Button
                title="Útvonal"
                size="md"
                variant="outline"
                left={<Ionicons name="navigate" size={16} color={Colors.ink} />}
                onPress={() => Linking.openURL(loc.mapsUrl)}
                style={styles.flex}
              />
            ) : null}
          </View>
        </Card>

        <Card title="Rendelésed">
          {order.lines.map((l, i) => (
            <View key={`${l.itemId}-${i}`} style={styles.line}>
              <T variant="bodyStrong" color={Colors.brandDark}>
                {l.qty}×
              </T>
              <View style={styles.flex}>
                <T variant="bodyStrong">{l.name}</T>
                {l.summary ? (
                  <T variant="small" color={Colors.textMuted}>
                    {l.summary}
                  </T>
                ) : null}
              </View>
              <T variant="small">{formatPrice(l.unitPrice * l.qty)}</T>
            </View>
          ))}
          <Divider />
          <SummaryRow label="Részösszeg" value={formatPrice(order.subtotal)} />
          {isDelivery ? (
            <SummaryRow label="Szállítási díj" value={formatPrice(order.deliveryFee)} />
          ) : null}
          {order.tip ? <SummaryRow label="Borravaló" value={formatPrice(order.tip)} /> : null}
          <SummaryRow label="Összesen" value={formatPrice(order.total)} strong />
        </Card>

        {done || rejected ? (
          <Button
            title={rejected ? 'Kosárba újra' : 'Újrarendelés'}
            left={<Ionicons name="refresh" size={18} color={Colors.white} />}
            onPress={reorder}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function headline(order: Order, now: number): { title: string; subtitle: string } {
  const delivery = order.mode === 'delivery';
  const minutesLeft = Math.max(Math.ceil((order.etaAt - now) / 60_000), 1);
  const eta = `${delivery ? 'Várható érkezés' : 'Átvehető'}: ${formatTime(order.etaAt)} · kb. ${minutesLeft} perc`;
  switch (order.status) {
    case 'pending':
      return {
        title: 'Rendelés elküldve',
        subtitle: 'Várjuk, hogy az étterem visszaigazolja – ez általában 1-2 perc.',
      };
    case 'accepted':
      return {
        title: 'Előrendelés elfogadva',
        subtitle: `${delivery ? 'Kiszállítás' : 'Átvehető'}: ${formatDayTime(order.etaAt, now)}`,
      };
    case 'preparing':
      return { title: 'Készül a rendelésed', subtitle: eta };
    case 'on_the_way':
      return { title: 'A futár úton van', subtitle: eta };
    case 'ready':
      return { title: 'Átvehető az étteremben', subtitle: 'Még melegen vár rád a pultnál.' };
    case 'completed': {
      const at = order.statusHistory.at(-1)?.at ?? order.updatedAt;
      return {
        title: delivery ? 'Megérkezett! Jó étvágyat!' : 'Átvéve – jó étvágyat!',
        subtitle: `${delivery ? 'Kiszállítva' : 'Átvéve'}: ${formatTime(at)}`,
      };
    }
    case 'rejected':
      return { title: 'Sajnáljuk!', subtitle: 'Ezt a rendelést most nem tudjuk teljesíteni.' };
  }
}

/** A futár/táska ikon helyzete az útvonal-illusztráción (0 = étterem, 1 = vendég). */
function travelFraction(order: Order, now: number): number {
  if (order.status === 'completed') return 1;
  if (order.mode === 'pickup') return order.status === 'ready' ? 1 : 0;
  if (order.status !== 'on_the_way') return 0;
  const start = order.statusHistory.findLast((h) => h.status === 'on_the_way')?.at ?? now;
  const span = Math.max(order.etaAt - start, 60_000);
  return Math.min(Math.max((now - start) / span, 0.05), 0.92);
}

function RouteNode({
  icon,
  label,
  side,
}: {
  icon: 'storefront' | 'home' | 'person';
  label: string;
  side: 'left' | 'right';
}) {
  return (
    <View style={[styles.routeNode, side === 'left' ? { left: -36 } : { right: -36 }]}>
      <View style={styles.routeNodeIcon}>
        <Ionicons name={icon} size={16} color={Colors.brand} />
      </View>
      <T variant="caption" color={Colors.textMuted}>
        {label}
      </T>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon:
    | 'storefront-outline'
    | 'location-outline'
    | 'wallet-outline'
    | 'call-outline'
    | 'calendar-outline';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.brand} />
      <View style={styles.flex}>
        <T variant="smallStrong">{label}</T>
        <T variant="small" color={Colors.textMuted}>
          {value}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgSoft },
  content: { paddingHorizontal: 16, gap: 16 },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarSpacer: { width: 40 },
  statusBlock: { gap: 4, marginTop: 4 },
  rejected: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dangerSoft,
  },
  segments: { flexDirection: 'row', gap: 6 },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  segmentFill: { backgroundColor: Colors.brand },
  route: {
    height: 92,
    paddingTop: 16,
    paddingHorizontal: 48,
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  track: { height: 36 },
  routeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  routeLineFill: { height: 4, backgroundColor: Colors.brand },
  routeNode: { position: 'absolute', top: 0, width: 72, alignItems: 'center', gap: 4 },
  routeNodeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mover: { position: 'absolute', top: 0, width: 0 },
  moverIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: -18,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
  },
  stepRow: { flexDirection: 'row', gap: 12, minHeight: 40 },
  stepRail: { alignItems: 'center', width: 20 },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  stepDotCurrent: { backgroundColor: Colors.bg, borderColor: Colors.brand, borderWidth: 6 },
  stepLine: { flex: 1, width: 2, backgroundColor: Colors.border, marginVertical: 2 },
  stepLineDone: { backgroundColor: Colors.brand },
  infoRow: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  line: { flexDirection: 'row', gap: 10, paddingVertical: 8, alignItems: 'flex-start' },
});
