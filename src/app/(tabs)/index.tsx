import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type ScrollViewInstance,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartBar } from '@/components/cart-bar';
import { CategoryChips } from '@/components/category-chips';
import { MenuItemRow } from '@/components/menu-item-row';
import { OpenBadge } from '@/components/open-badge';
import { PopularCard } from '@/components/popular-card';
import { Segmented } from '@/components/ui/segmented';
import { T } from '@/components/ui/text';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { RESTAURANT } from '@/data/locations';
import { CATEGORIES, itemsInCategory, MENU } from '@/data/menu';
import { formatFee, formatPrice, formatRange, formatTime } from '@/lib/format';
import { openStatus } from '@/lib/hours';
import { isFinal, STEP_LABELS, stepIndex } from '@/lib/order-status';
import { useNow } from '@/lib/use-now';
import { openProduct, useQuickAdd } from '@/lib/use-quick-add';
import { useRestaurantStatus, useSoldOut } from '@/lib/use-restaurant-status';
import { useStatusBarStyle } from '@/lib/use-status-bar';
import { deliveryZone, useApp } from '@/store/app-store';

const HERO_HEIGHT = 230;
const COMPACT_TITLE_HEIGHT = 48;
const CHIPS_HEIGHT = 52;
const POPULAR = MENU.filter((m) => m.popular);

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { location, mode, address, cart, orders, dispatch } = useApp();
  const quickAdd = useQuickAdd();
  const now = useNow();

  const scrollRef = useRef<ScrollViewInstance>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [active, setActive] = useState(CATEGORIES[0].id);
  const [compact, setCompact] = useState(false);
  const [headerAnim] = useState(() => new Animated.Value(0));

  const headerHeight = insets.top + COMPACT_TITLE_HEIGHT + CHIPS_HEIGHT;
  const status = openStatus(location, new Date(now));
  const zone = deliveryZone(location, address.town);
  const activeOrder = orders.find((o) => !isFinal(o.status));
  const restaurant = useRestaurantStatus(location.id);
  const soldOut = useSoldOut();

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: compact ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [compact, headerAnim]);

  useStatusBarStyle(compact ? 'dark' : 'light');

  const scrollToCategory = (id: string) => {
    const y = sectionY.current[id];
    if (y === undefined) return;
    setActive(id);
    scrollRef.current?.scrollTo({ y: y - headerHeight + 1, animated: true });
  };

  // A Keresés fülről érkező kategória-ugrás (?category=...)
  useEffect(() => {
    if (!params.category) return;
    const t = setTimeout(() => scrollToCategory(params.category!), 50);
    router.setParams({ category: undefined });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.category]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    // A kompakt fejléc már a fejléckép eltűnésekor megjelenik, így a státuszsor sosem lóg tartalom fölé.
    const shouldCompact = y > HERO_HEIGHT - COMPACT_TITLE_HEIGHT;
    if (shouldCompact !== compact) setCompact(shouldCompact);

    let current = CATEGORIES[0].id;
    for (const c of CATEGORIES) {
      const sy = sectionY.current[c.id];
      if (sy !== undefined && sy - headerHeight - 8 <= y) current = c.id;
    }
    if (current !== active) setActive(current);
  };

  const qtyOf = (itemId: string) =>
    cart.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0);

  const eta = mode === 'delivery' ? zone.eta : location.pickupEta;

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <View style={{ height: HERO_HEIGHT + insets.top }}>
          <Image
            source={{ uri: RESTAURANT.heroImage }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroTop, { paddingTop: insets.top + 8 }]}>
            <View style={styles.locationPill}>
              <Ionicons name="location" size={18} color={Colors.white} />
              <View>
                <T variant="caption" color="rgba(255,255,255,0.8)">
                  {mode === 'delivery' ? 'Kiszállítás innen' : 'Átvétel itt'}
                </T>
                <T variant="smallStrong" color={Colors.white}>
                  {location.city}
                </T>
              </View>
            </View>
            <View style={styles.row}>
              <CircleButton icon="search" label="Keresés" onPress={() => router.navigate('/search')} />
              <CircleButton
                icon="information-circle-outline"
                label="Étterem információk"
                onPress={() => router.push('/info')}
              />
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.logoRow}>
            <View style={styles.logo}>
              <T variant="h2" color={Colors.brand}>
                EK
              </T>
            </View>
            <View style={styles.flex}>
              <T variant="display" style={styles.wordmark}>
                {RESTAURANT.name.toUpperCase()}
              </T>
              <T variant="small" color={Colors.textMuted}>
                {RESTAURANT.tagline}
              </T>
            </View>
          </View>

          <View style={styles.badgesRow}>
            <View style={styles.rating}>
              <Ionicons name="star" size={13} color={Colors.brand} />
              <T variant="smallStrong">{String(RESTAURANT.rating).replace('.', ',')}</T>
              <T variant="small" color={Colors.textMuted}>
                ({RESTAURANT.ratingCount})
              </T>
            </View>
            <OpenBadge status={status} />
          </View>

          <View style={styles.statsRow}>
            <Stat icon={mode === 'delivery' ? 'bicycle' : 'walk'} value={formatRange(eta)} label={mode === 'delivery' ? 'Szállítás' : 'Elkészül'} />
            <View style={styles.statDivider} />
            {mode === 'delivery' ? (
              <>
                <Stat icon="pricetag-outline" value={formatFee(zone.fee)} label={`Díj · ${zone.town}`} />
                <View style={styles.statDivider} />
                <Stat icon="basket-outline" value={formatPrice(location.minOrder)} label="Min. rendelés" />
              </>
            ) : (
              <Stat icon="storefront-outline" value={location.city} label={location.address.replace(/^\d+\s/, '')} />
            )}
          </View>

          <Segmented
            value={mode}
            onChange={(m) => dispatch({ type: 'setMode', mode: m })}
            options={[
              { value: 'delivery', label: 'Kiszállítás', icon: 'bicycle' },
              { value: 'pickup', label: 'Elvitel', icon: 'bag-handle-outline' },
            ]}
          />
        </View>

        {activeOrder ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/order/[id]', params: { id: activeOrder.id } })
            }
            style={styles.activeOrder}>
            <View style={styles.activeOrderIcon}>
              <Ionicons name="time-outline" size={20} color={Colors.white} />
            </View>
            <View style={styles.flex}>
              <T variant="smallStrong" color={Colors.white}>
                {STEP_LABELS[activeOrder.mode][stepIndex(activeOrder.status)]}
              </T>
              <T variant="small" color="rgba(255,255,255,0.75)">
                {activeOrder.number} · várható: {formatTime(activeOrder.etaAt)}
              </T>
            </View>
            <T variant="smallStrong" color={Colors.white}>
              Követés
            </T>
            <Ionicons name="chevron-forward" size={16} color={Colors.white} />
          </Pressable>
        ) : null}

        {!status.open ? (
          <View style={styles.notice}>
            <Ionicons name="moon-outline" size={18} color={Colors.brandDark} />
            <T variant="small" color={Colors.brandDark} style={styles.flex}>
              Az étterem most zárva. Előrendelést leadhatsz – {status.detail.toLowerCase()}.
            </T>
          </View>
        ) : null}

        {restaurant?.paused ? (
          <View style={[styles.notice, styles.noticeDanger]}>
            <Ionicons name="pause-circle-outline" size={18} color={Colors.danger} />
            <T variant="small" color={Colors.danger} style={styles.flex}>
              Az étterem most nem fogad online rendelést. Telefonon elérhetők: {location.phone}
            </T>
          </View>
        ) : null}

        {location.id === 'monor' ? (
          <View style={styles.promo}>
            <Ionicons name="bicycle" size={22} color={Colors.brand} />
            <View style={styles.flex}>
              <T variant="smallStrong" color={Colors.white}>
                Házhozszállítás a környéken is
              </T>
              <T variant="small" color="rgba(255,255,255,0.7)">
                {location.deliveryZones.map((z) => z.town).join(' · ')}
              </T>
            </View>
          </View>
        ) : null}

        <CategoryChips categories={CATEGORIES} active={active} onSelect={scrollToCategory} />

        <View style={styles.section}>
          <T variant="h2" style={styles.sectionTitle}>
            Népszerű
          </T>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.popularList}>
            {POPULAR.filter((item) => !soldOut.has(item.id)).map((item) => (
              <PopularCard
                key={item.id}
                item={item}
                onPress={() => openProduct(item)}
                onAdd={() => quickAdd(item)}
              />
            ))}
          </ScrollView>
        </View>

        {CATEGORIES.map((c) => (
          <View
            key={c.id}
            style={styles.section}
            onLayout={(e) => {
              sectionY.current[c.id] = e.nativeEvent.layout.y;
            }}>
            <View style={styles.sectionHeader}>
              <T variant="h2">{c.name}</T>
              {c.subtitle ? (
                <T variant="small" color={Colors.textMuted}>
                  {c.subtitle}
                </T>
              ) : null}
            </View>
            {itemsInCategory(c.id).map((item) => (
              <MenuItemRow
                key={item.id}
                item={item}
                qtyInCart={qtyOf(item.id)}
                soldOut={soldOut.has(item.id)}
                onPress={() => openProduct(item)}
                onAdd={() => quickAdd(item)}
              />
            ))}
          </View>
        ))}

        <T variant="small" color={Colors.textFaint} style={styles.footnote}>
          Az ételek allergénjeiről érdeklődj az étteremben: {location.phone}
        </T>
      </ScrollView>

      <Animated.View
        style={[
          styles.compactHeader,
          {
            paddingTop: insets.top,
            opacity: headerAnim,
            pointerEvents: compact ? 'auto' : 'none',
            transform: [
              { translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
            ],
          },
        ]}>
        <View style={styles.compactTitle}>
          <View style={styles.flex}>
            <T variant="h3" numberOfLines={1}>
              {RESTAURANT.name} · {location.city}
            </T>
          </View>
          <Pressable
            accessibilityLabel="Keresés"
            hitSlop={10}
            onPress={() => router.navigate('/search')}>
            <Ionicons name="search" size={22} color={Colors.ink} />
          </Pressable>
        </View>
        <CategoryChips categories={CATEGORIES} active={active} onSelect={scrollToCategory} />
      </Animated.View>

      <CartBar />
    </View>
  );
}

function CircleButton({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={styles.circleBtn}>
      <Ionicons name={icon} size={20} color={Colors.white} />
    </Pressable>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.row}>
        <Ionicons name={icon} size={14} color={Colors.brand} />
        <T variant="smallStrong" numberOfLines={1}>
          {value}
        </T>
      </View>
      <T variant="caption" color={Colors.textMuted} numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { paddingBottom: 110 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    marginTop: -56,
    marginHorizontal: 16,
    padding: 16,
    gap: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bg,
    boxShadow: Shadow.card,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { fontSize: 22, lineHeight: 28, letterSpacing: 1.5 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: Colors.border },
  activeOrder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.brand,
  },
  activeOrderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.brandSoft,
  },
  noticeDanger: { backgroundColor: Colors.dangerSoft },
  promo: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.ink,
  },
  section: { marginTop: 20 },
  sectionTitle: { paddingHorizontal: 16, marginBottom: 12 },
  sectionHeader: { paddingHorizontal: 16, gap: 2, marginBottom: 4 },
  popularList: { paddingHorizontal: 16, gap: 12 },
  footnote: { textAlign: 'center', paddingHorizontal: 32, marginTop: 24 },
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.bg,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  compactTitle: {
    height: COMPACT_TITLE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
});
