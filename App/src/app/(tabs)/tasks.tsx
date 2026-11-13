import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, TouchTarget, Typography } from '@/constants/theme';
import { getNote, openTasksAcrossNotes, updateNote } from '@/features/notes/repository';
import { useTheme } from '@/hooks/use-theme';
import { toggleChecklistLine } from '@/lib/markdown';

type Task = Awaited<ReturnType<typeof openTasksAcrossNotes>>[number];

export default function TasksScreen() {
  const theme = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = useCallback(async () => {
    setTasks(await openTasksAcrossNotes());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sections = useMemo(() => {
    const map = new Map<string, { noteId: string; title: string; data: Task[] }>();
    for (const t of tasks) {
      const s = map.get(t.noteId) ?? { noteId: t.noteId, title: t.noteTitle, data: [] };
      s.data.push(t);
      map.set(t.noteId, s);
    }
    return [...map.values()];
  }, [tasks]);

  async function complete(task: Task) {
    // Optimistic removal
    setTasks((prev) => prev.filter((t) => !(t.noteId === task.noteId && t.lineIndex === task.lineIndex)));
    const note = await getNote(task.noteId);
    if (!note || note.encrypted) return load();
    await updateNote(note.id, { body: toggleChecklistLine(note.body, task.lineIndex) });
    load();
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Tasks</Text>
        <Text style={[styles.count, { color: theme.textSecondary }]}>{tasks.length} open</Text>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(t) => `${t.noteId}:${t.lineIndex}`}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/note/[id]', params: { id: section.noteId } })}
            accessibilityRole="link"
            style={styles.sectionHead}>
            <Text numberOfLines={1} style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {section.title}
            </Text>
          </Pressable>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => complete(item)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: false }}
            style={styles.row}>
            <View style={[styles.box, { borderColor: theme.textMuted }]} />
            <Text style={[styles.rowText, { color: theme.text }]}>{item.text || 'Untitled task'}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>All clear</Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              Checklist items like “- [ ] task” from any note show up here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  title: { ...Typography.display },
  count: { ...Typography.callout },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, flexGrow: 1 },
  sectionHead: { minHeight: TouchTarget, justifyContent: 'flex-end', paddingBottom: Spacing.one },
  sectionTitle: { ...Typography.label, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: TouchTarget },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5 },
  rowText: { ...Typography.body, flex: 1 },
  empty: { alignItems: 'center', paddingTop: Spacing.eight, gap: Spacing.two },
  emptyTitle: { ...Typography.subtitle },
  emptyBody: { ...Typography.body, textAlign: 'center' },
});
