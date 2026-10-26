import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, type ScrollViewInstance } from 'react-native';

import { T } from '@/components/ui/text';
import { Colors, Radius } from '@/constants/theme';
import type { Category } from '@/data/menu';

type Props = {
  categories: Category[];
  active: string;
  onSelect: (id: string) => void;
};

/** Vízszintes kategória-választó; az aktív kategória mindig látható marad. */
export function CategoryChips({ categories, active, onSelect }: Props) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const positions = useRef<Record<string, number>>({});

  useEffect(() => {
    const x = positions.current[active];
    if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
  }, [active]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      {categories.map((c) => {
        const selected = c.id === active;
        return (
          <Pressable
            key={c.id}
            onLayout={(e) => {
              positions.current[c.id] = e.nativeEvent.layout.x;
            }}
            onPress={() => onSelect(c.id)}
            style={[styles.chip, selected && styles.chipActive]}>
            <T variant="smallStrong" color={selected ? Colors.white : Colors.text}>
              {c.name}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: Colors.ink },
});
