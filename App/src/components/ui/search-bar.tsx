import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radii, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search notes',
  autoFocus,
  onSubmitEditing,
  style,
}: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.backgroundElement }, style]}>
      <Text style={[styles.icon, { color: theme.textMuted }]}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        selectionColor={theme.primary}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        accessibilityLabel={placeholder}
        style={[styles.input, { color: theme.text }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          style={styles.clear}>
          <Text style={{ color: theme.textMuted, fontSize: 16 }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget,
    borderRadius: Radii.md,
    paddingLeft: Spacing.three,
  },
  icon: { fontSize: 20, marginRight: Spacing.two },
  input: { flex: 1, fontSize: 16, minHeight: TouchTarget },
  clear: {
    width: TouchTarget,
    height: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
