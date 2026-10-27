import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartBar } from '@/components/cart-bar';
import { MenuItemRow } from '@/components/menu-item-row';
import { EmptyState } from '@/components/ui/empty-state';
import { T } from '@/components/ui/text';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { CATEGORIES, itemsInCategory, searchMenu } from '@/data/menu';
import { openProduct, useQuickAdd } from '@/lib/use-quick-add';
import { useSoldOut } from '@/lib/use-restaurant-status';
import { useStatusBarStyle } from '@/lib/use-status-bar';
import { useApp } from '@/store/app-store';

const SUGGESTIONS = ['Tál', 'Dürüm', 'Istanbul', 'Falafel', 'Nuggets', 'Szósz', 'Baklava'];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { cart } = useApp();
  const quickAdd = useQuickAdd();
  const soldOut = useSoldOut();
  const [query, setQuery] = useState('');
  const results = searchMenu(query);

  useStatusBarStyle('dark');

  const qtyOf = (itemId: string) =>
    cart.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <T variant="h1" style={styles.title}>
        Keresés
      </T>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Mit ennél? pl. feta, borjú, falafel"
          placeholderTextColor={Colors.textFaint}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable accessibilityLabel="Törlés" hitSlop={10} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {query.trim() ? (
        results.length ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <MenuItemRow
                item={item}
                qtyInCart={qtyOf(item.id)}
                soldOut={soldOut.has(item.id)}
                onPress={() => openProduct(item)}
                onAdd={() => quickAdd(item)}
              />
            )}
          />
        ) : (
          <EmptyState
            icon="search-outline"
            title="Nincs találat"
            text={`A(z) „${query.trim()}” keresésre nincs találat. Próbáld pl. így: „tál” vagy „feta”.`}
          />
        )
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
          <T variant="h3" style={styles.blockTitle}>
            Népszerű keresések
          </T>
          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} onPress={() => setQuery(s)} style={styles.chip}>
                <Ionicons name="trending-up" size={14} color={Colors.brand} />
                <T variant="smallStrong">{s}</T>
              </Pressable>
            ))}
          </View>

          <T variant="h3" style={styles.blockTitle}>
            Kategóriák
          </T>
          <View style={styles.grid}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.navigate({ pathname: '/', params: { category: c.id } })}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
                <T variant="bodyStrong">{c.name}</T>
                <T variant="small" color={Colors.textMuted}>
                  {itemsInCategory(c.id).length} tétel
                </T>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
      <CartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  title: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSoft,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: { flex: 1, fontFamily: Fonts.medium, fontSize: 15, color: Colors.text, height: '100%' },
  list: { paddingBottom: 110, paddingTop: 8 },
  blockTitle: { paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  tile: {
    width: '48%',
    flexGrow: 1,
    padding: 14,
    gap: 2,
    borderRadius: Radius.lg,
    backgroundColor: Colors.brandSoft,
  },
  tilePressed: { opacity: 0.7 },
});
