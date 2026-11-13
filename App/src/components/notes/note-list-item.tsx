import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TagChips } from '@/components/notes/tag-chips';
import { Radii, Spacing, TouchTarget, Typography } from '@/constants/theme';
import type { Note } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { extractTags } from '@/lib/markdown';

type Props = {
  note: Note;
  onPress: (note: Note) => void;
  onLongPress?: (note: Note) => void;
};

function preview(note: Note) {
  if (note.encrypted) return 'Encrypted note';
  const lines = note.body
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').replace(/^\s*[-*]\s+\[[ xX]\]\s*/, '').trim())
    .filter(Boolean);
  // Skip the line used as title
  const rest = lines[0] === note.title ? lines.slice(1) : lines;
  return rest.join(' ').slice(0, 140);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function NoteListItemBase({ note, onPress, onLongPress }: Props) {
  const theme = useTheme();
  const tags = note.encrypted ? [] : extractTags(`${note.title}\n${note.body}`).slice(0, 3);
  const text = preview(note);

  return (
    <Pressable
      onPress={() => onPress(note)}
      onLongPress={onLongPress ? () => onLongPress(note) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${note.title || 'Untitled'}${note.pinned ? ', pinned' : ''}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundElement : theme.card,
          borderColor: theme.border,
        },
      ]}>
      <View style={styles.head}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
          {note.encrypted ? '🔒 ' : ''}
          {note.title || 'Untitled'}
        </Text>
        {note.pinned ? (
          <View style={[styles.pin, { backgroundColor: theme.pin }]} accessibilityLabel="Pinned" />
        ) : null}
        <Text style={[styles.date, { color: theme.textMuted }]}>{formatDate(note.updatedAt)}</Text>
      </View>
      {text ? (
        <Text numberOfLines={2} style={[styles.preview, { color: theme.textSecondary }]}>
          {text}
        </Text>
      ) : null}
      {tags.length ? (
        <View style={styles.tags}>
          <TagChips tags={tags} small />
        </View>
      ) : null}
    </Pressable>
  );
}

export const NoteListItem = memo(NoteListItemBase);

const styles = StyleSheet.create({
  row: {
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { ...Typography.subtitle, flex: 1 },
  pin: { width: 8, height: 8, borderRadius: 4 },
  date: { ...Typography.caption },
  preview: { ...Typography.caption, fontSize: 14, lineHeight: 20 },
  tags: { marginTop: Spacing.one },
});
