import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radii, Spacing, TouchTarget } from '@/constants/theme';
import type { Note } from '@/db/schema';
import { createNote } from '@/features/notes/repository';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  onCreated?: (note: Note) => void;
  placeholder?: string;
};

export function QuickCapture({ onCreated, placeholder = 'Capture a thought…' }: Props) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const note = await createNote({ body: value });
      setText('');
      onCreated?.(note);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.wrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        selectionColor={theme.primary}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={submit}
        accessibilityLabel="Quick capture"
        style={[styles.input, { color: theme.text }]}
      />
      <Pressable
        onPress={submit}
        disabled={!text.trim() || busy}
        accessibilityRole="button"
        accessibilityLabel="Add note"
        style={[
          styles.add,
          { backgroundColor: theme.primary, opacity: text.trim() && !busy ? 1 : 0.35 },
        ]}>
        <Text style={{ color: theme.primaryForeground, fontSize: 22, lineHeight: 24 }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    minHeight: TouchTarget + Spacing.one,
    gap: Spacing.two,
  },
  input: { flex: 1, fontSize: 16, minHeight: TouchTarget },
  add: {
    width: TouchTarget - 4,
    height: TouchTarget - 4,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
