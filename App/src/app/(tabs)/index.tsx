import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoteListItem } from '@/components/notes/note-list-item';
import { QuickCapture } from '@/components/notes/quick-capture';
import { TagChips } from '@/components/notes/tag-chips';
import { SearchBar } from '@/components/ui/search-bar';
import { SyncStatus } from '@/components/sync-status';
import { Radii, Spacing, TouchTarget, Typography } from '@/constants/theme';
import type { Note } from '@/db/schema';
import { createNote, listNotes, listTags, updateNote } from '@/features/notes/repository';
import { useTheme } from '@/hooks/use-theme';

function openNote(id: string) {
  router.push({ pathname: '/note/[id]', params: { id } });
}

export default function NotesScreen() {
  const theme = useTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    const [rows, allTags] = await Promise.all([
      listNotes({ archived, query: query.trim() || undefined, tag: tag ?? undefined }),
      listTags(),
    ]);
    setNotes(rows);
    setTagNames(allTags.map((t) => t.name));
  }, [archived, query, tag]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const h = setTimeout(load, 150);
    return () => clearTimeout(h);
  }, [load]);

  const reload = useCallback(() => {
    setRefreshKey((k) => k + 1);
    load();
  }, [load]);

  async function newNote() {
    const n = await createNote({ body: '' });
    openNote(n.id);
  }

  function rowActions(note: Note) {
    Alert.alert(note.title || 'Untitled', undefined, [
      {
        text: note.pinned ? 'Unpin' : 'Pin',
        onPress: async () => {
          await updateNote(note.id, { pinned: !note.pinned }, { snapshot: false });
          load();
        },
      },
      {
        text: note.archived ? 'Unarchive' : 'Archive',
        onPress: async () => {
          await updateNote(note.id, { archived: !note.archived }, { snapshot: false });
          load();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{archived ? 'Archive' : 'Notes'}</Text>
        <View style={styles.headerActions}>
          <SyncStatus compact refreshKey={refreshKey} onSynced={load} />
          <IconButton label="Daily note" glyph="☀" onPress={() => router.push('/daily')} />
          <IconButton label="Command palette" glyph="⌘" onPress={() => router.push('/palette')} />
        </View>
      </View>

      <View style={styles.controls}>
        <SearchBar value={query} onChangeText={setQuery} />
        {!archived && !query ? <QuickCapture onCreated={reload} /> : null}
        <View style={styles.filterRow}>
          <View style={{ flex: 1 }}>
            <TagChips tags={tagNames} selected={tag} onSelect={setTag} scroll showAll />
          </View>
          <Pressable
            onPress={() => setArchived((a) => !a)}
            accessibilityRole="button"
            accessibilityState={{ selected: archived }}
            style={[
              styles.archiveBtn,
              { backgroundColor: archived ? theme.primary : theme.backgroundElement },
            ]}>
            <Text
              style={{
                ...Typography.callout,
                fontSize: 13,
                color: archived ? theme.primaryForeground : theme.textSecondary,
              }}>
              Archive
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <NoteListItem note={item} onPress={(n) => openNote(n.id)} onLongPress={rowActions} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {query ? 'No matches' : archived ? 'Archive is empty' : 'No notes yet'}
            </Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              {query
                ? 'Try a different search or tag.'
                : archived
                  ? 'Archived notes show up here.'
                  : 'Capture a thought above or tap + to start writing.'}
            </Text>
          </View>
        }
      />

      <Pressable
        onPress={newNote}
        accessibilityRole="button"
        accessibilityLabel="New note"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
        ]}>
        <Text style={{ color: theme.primaryForeground, fontSize: 28, lineHeight: 30 }}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function IconButton({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}>
      <Text style={{ color: theme.text, fontSize: 18 }}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  title: { ...Typography.display },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBtn: {
    width: TouchTarget,
    height: TouchTarget,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { paddingHorizontal: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.three },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  archiveBtn: {
    minHeight: 32,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.full,
    justifyContent: 'center',
  },
  list: { paddingHorizontal: Spacing.four, paddingBottom: 120, flexGrow: 1 },
  empty: { alignItems: 'center', paddingTop: Spacing.eight, gap: Spacing.two },
  emptyTitle: { ...Typography.subtitle },
  emptyBody: { ...Typography.body, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.five,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
