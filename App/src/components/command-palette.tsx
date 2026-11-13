import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { SearchBar } from '@/components/ui/search-bar';
import { Radii, Spacing, TouchTarget, Typography } from '@/constants/theme';
import type { Note } from '@/db/schema';
import { createNote, getOrCreateDailyNote, listNotes } from '@/features/notes/repository';
import { useTheme } from '@/hooks/use-theme';

type Item =
  | { kind: 'command'; id: string; label: string; hint?: string; run: () => void | Promise<void> }
  | { kind: 'note'; id: string; label: string; hint?: string; run: () => void };

type Props = {
  onClose: () => void;
};

function openNote(id: string) {
  router.push({ pathname: '/note/[id]', params: { id } });
}

export function CommandPalette({ onClose }: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Note[]>([]);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      const rows = await listNotes({ query: query.trim() || undefined });
      if (!cancelled) setResults(rows.slice(0, 20));
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim();
    const go = (fn: () => void | Promise<void>) => async () => {
      onClose();
      await fn();
    };

    const commands: Item[] = [
      {
        kind: 'command',
        id: 'new',
        label: 'New note',
        hint: 'Create an empty note',
        run: go(async () => {
          const n = await createNote({ body: '' });
          openNote(n.id);
        }),
      },
      {
        kind: 'command',
        id: 'daily',
        label: "Today's daily note",
        run: go(async () => {
          const n = await getOrCreateDailyNote();
          openNote(n.id);
        }),
      },
      { kind: 'command', id: 'tasks', label: 'Open tasks', run: go(() => router.navigate('/tasks')) },
      { kind: 'command', id: 'graph', label: 'Open graph', run: go(() => router.navigate('/graph')) },
      { kind: 'command', id: 'settings', label: 'Open settings', run: go(() => router.navigate('/settings')) },
    ];

    const filtered = q
      ? commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()))
      : commands;

    const create: Item[] = q
      ? [
          {
            kind: 'command',
            id: 'create',
            label: `Create "${q}"`,
            hint: 'New note with this title',
            run: go(async () => {
              const n = await createNote({ title: q, body: `# ${q}\n\n` });
              openNote(n.id);
            }),
          },
        ]
      : [];

    const noteItems: Item[] = results.map((n) => ({
      kind: 'note',
      id: n.id,
      label: n.title || 'Untitled',
      hint: n.encrypted ? 'Encrypted' : undefined,
      run: () => {
        onClose();
        openNote(n.id);
      },
    }));

    return [...noteItems, ...create, ...filtered];
  }, [query, results, onClose]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search, jump, or create…"
          autoFocus
          style={styles.search}
        />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.close}>
          <Text style={{ color: theme.primary, ...Typography.callout }}>Cancel</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => item.run()}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: theme.backgroundElement },
            ]}>
            <View
              style={[
                styles.badge,
                { backgroundColor: item.kind === 'note' ? theme.backgroundElement : theme.primary },
              ]}>
              <Text
                style={{
                  color: item.kind === 'note' ? theme.textSecondary : theme.primaryForeground,
                  ...Typography.label,
                }}>
                {item.kind === 'note' ? 'N' : '⌘'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: theme.text, ...Typography.subtitle, fontSize: 16 }}>
                {item.label}
              </Text>
              {item.hint ? (
                <Text style={{ color: theme.textMuted, ...Typography.caption }}>{item.hint}</Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  search: { flex: 1 },
  close: { minHeight: TouchTarget, justifyContent: 'center', paddingHorizontal: Spacing.one },
  list: { padding: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: TouchTarget + Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
