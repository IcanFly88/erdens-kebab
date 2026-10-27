import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Stepper } from '@/components/ui/stepper';
import { T } from '@/components/ui/text';
import { Colors, Fonts, Radius } from '@/constants/theme';
import {
  getItem,
  groupsFor,
  missingRequired,
  unitPrice,
  type OptionGroup,
  type Selections,
} from '@/data/menu';
import { formatPrice } from '@/lib/format';
import { useSoldOut } from '@/lib/use-restaurant-status';
import { useStatusBarStyle } from '@/lib/use-status-bar';
import { useApp } from '@/store/app-store';

export default function ProductScreen() {
  const { id, line } = useLocalSearchParams<{ id: string; line?: string }>();
  const insets = useSafeAreaInsets();
  const { cart, dispatch } = useApp();
  const item = getItem(id);
  const existing = line ? cart.find((l) => l.key === line) : undefined;
  const soldOut = useSoldOut();

  const [selections, setSelections] = useState<Selections>(existing?.selections ?? {});
  const [qty, setQty] = useState(existing?.qty ?? 1);
  const [note, setNote] = useState(existing?.note ?? '');
  const [highlight, setHighlight] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const groupY = useRef<Record<string, number>>({});

  useStatusBarStyle('light');

  if (!item) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="A termék nem található"
        action={<Button title="Vissza" onPress={() => router.back()} />}
      />
    );
  }

  const groups = groupsFor(item);
  const missing = missingRequired(item, selections);
  const total = unitPrice(item, selections) * qty;
  // Már kosárban lévő tételt menteni még lehet (a kosár jelzi, hogy ki kell venni).
  const unavailable = soldOut.has(item.id) && !existing;

  const toggle = (group: OptionGroup, choiceId: string) => {
    setHighlight(null);
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (group.type === 'single') return { ...prev, [group.id]: [choiceId] };
      if (current.includes(choiceId)) {
        return { ...prev, [group.id]: current.filter((c) => c !== choiceId) };
      }
      if (group.max && current.length >= group.max) return prev;
      return { ...prev, [group.id]: [...current, choiceId] };
    });
  };

  const submit = () => {
    if (missing) {
      setHighlight(missing.id);
      const y = groupY.current[missing.id];
      if (y !== undefined) scrollRef.current?.scrollTo({ y: y - 16, animated: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    const payload = { itemId: item.id, qty, selections, note: note.trim() || undefined };
    if (existing) dispatch({ type: 'replaceLine', key: existing.key, line: payload });
    else dispatch({ type: 'addLine', line: payload });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <View style={styles.hero}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
              <Ionicons name="fast-food-outline" size={64} color={Colors.brand} />
            </View>
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
            style={styles.heroShade}
          />
          <Pressable
            accessibilityLabel="Bezárás"
            onPress={() => router.back()}
            style={[styles.close, { top: Platform.OS === 'android' ? insets.top + 12 : 16 }]}>
            <Ionicons name="close" size={22} color={Colors.ink} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <T variant="h1">{item.name}</T>
          <T variant="bodyStrong" color={Colors.brandDark}>
            {formatPrice(item.price)}
          </T>
          {item.description ? <T color={Colors.textMuted}>{item.description}</T> : null}
        </View>

        {groups.map((group) => {
          const chosen = selections[group.id] ?? [];
          const satisfied = !group.required || chosen.length > 0;
          const isHighlighted = highlight === group.id;
          return (
            <View
              key={group.id}
              onLayout={(e) => {
                groupY.current[group.id] = e.nativeEvent.layout.y;
              }}
              style={styles.group}>
              <View style={[styles.groupHeader, isHighlighted && styles.groupHeaderError]}>
                <View style={styles.flex}>
                  <T variant="h3">{group.title}</T>
                  <T variant="small" color={Colors.textMuted}>
                    {group.type === 'single'
                      ? 'Válassz egyet'
                      : group.max
                        ? `Legfeljebb ${group.max} választható`
                        : 'Több is választható'}
                  </T>
                </View>
                {group.required ? (
                  <View style={[styles.badge, satisfied ? styles.badgeOk : styles.badgeReq]}>
                    {satisfied ? <Ionicons name="checkmark" size={12} color={Colors.success} /> : null}
                    <T variant="caption" color={satisfied ? Colors.success : Colors.white}>
                      Kötelező
                    </T>
                  </View>
                ) : (
                  <T variant="caption" color={Colors.textMuted}>
                    Opcionális
                  </T>
                )}
              </View>
              <View style={styles.choices}>
                {group.choices.map((choice) => {
                  const selected = chosen.includes(choice.id);
                  const atMax =
                    group.type === 'multi' && !!group.max && chosen.length >= group.max && !selected;
                  return (
                    <ChoiceRow
                      key={choice.id}
                      kind={group.type === 'single' ? 'radio' : 'check'}
                      label={choice.name}
                      selected={selected}
                      disabled={atMax}
                      onPress={() => toggle(group, choice.id)}
                      trailing={
                        choice.price ? (
                          <T variant="small" color={Colors.textMuted}>
                            +{formatPrice(choice.price)}
                          </T>
                        ) : null
                      }
                    />
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <T variant="h3">Megjegyzés a konyhának</T>
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="pl. extra ropogósra kérem"
            placeholderTextColor={Colors.textFaint}
            style={styles.note}
            multiline
            maxLength={140}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Stepper value={qty} onChange={setQty} />
        <Button
          title={
            unavailable
              ? 'Elfogyott'
              : existing
                ? 'Mentés'
                : missing
                  ? `Válassz: ${missing.title.toLowerCase()}`
                  : 'Kosárba'
          }
          trailing={formatPrice(total)}
          onPress={submit}
          disabled={unavailable}
          variant={missing || unavailable ? 'dark' : 'primary'}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  hero: { height: 260, backgroundColor: Colors.bgSoft },
  heroShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 100 },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandSoft },
  close: {
    position: 'absolute',
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 16, gap: 6 },
  group: { marginTop: 8 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgSoft,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  groupHeaderError: { backgroundColor: Colors.dangerSoft },
  choices: { paddingHorizontal: 16 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeReq: { backgroundColor: Colors.ink },
  badgeOk: { backgroundColor: Colors.successSoft },
  note: {
    margin: 16,
    minHeight: 80,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
