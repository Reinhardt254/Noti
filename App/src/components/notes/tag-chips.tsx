import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  tags: string[];
  selected?: string | null;
  onSelect?: (tag: string | null) => void;
  /** Horizontal scrolling row (filters) vs wrapping row (inline). */
  scroll?: boolean;
  /** Show an "All" chip first (filter mode). */
  showAll?: boolean;
  small?: boolean;
};

export function TagChips({ tags, selected, onSelect, scroll, showAll, small }: Props) {
  const theme = useTheme();
  if (!tags.length && !showAll) return null;

  const chip = (label: string, value: string | null) => {
    const active = (selected ?? null) === value;
    const content = (
      <Text
        style={[
          small ? styles.textSmall : styles.text,
          { color: active ? theme.primaryForeground : theme.tag },
        ]}>
        {value === null ? label : `#${label}`}
      </Text>
    );
    const style = [
      small ? styles.chipSmall : styles.chip,
      {
        backgroundColor: active ? theme.primary : theme.backgroundElement,
      },
    ];
    if (!onSelect) {
      return (
        <View key={label} style={style}>
          {content}
        </View>
      );
    }
    return (
      <Pressable
        key={label}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => onSelect(active && value !== null ? null : value)}
        style={style}>
        {content}
      </Pressable>
    );
  };

  const items = [
    ...(showAll ? [chip('All', null)] : []),
    ...tags.map((t) => chip(t, t)),
  ];

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {items}
      </ScrollView>
    );
  }
  return <View style={[styles.row, styles.wrap]}>{items}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  wrap: { flexWrap: 'wrap' },
  chip: {
    minHeight: 32,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.full,
    justifyContent: 'center',
  },
  chipSmall: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  text: { ...Typography.callout, fontSize: 13 },
  textSmall: { ...Typography.label, textTransform: 'none' },
});
