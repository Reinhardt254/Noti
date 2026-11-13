import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Radii, Spacing, TouchTarget, Typography } from '@/constants/theme';
import type { NoteVersion } from '@/db/schema';
import { listVersions, restoreVersion } from '@/features/notes/repository';
import { useTheme } from '@/hooks/use-theme';

export default function HistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (id) listVersions(id).then(setVersions);
    }, [id]),
  );

  function restore(v: NoteVersion) {
    Alert.alert('Restore this version?', 'Your current text is saved to history first.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          await restoreVersion(id, v.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Text style={{ color: theme.text, fontSize: 32, lineHeight: 34 }}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>History</Text>
      </View>
      <FlatList
        data={versions}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        renderItem={({ item }) => {
          const open = expanded === item.id;
          return (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Pressable
                onPress={() => setExpanded(open ? null : item.id)}
                accessibilityRole="button"
                style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.text }]}>
                    {item.title || 'Untitled'}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textMuted }]}>
                    {new Date(item.createdAt).toLocaleString()} · {item.reason}
                  </Text>
                </View>
                <Text style={{ color: theme.textMuted }}>{open ? '▴' : '▾'}</Text>
              </Pressable>
              {open ? (
                <View style={styles.body}>
                  <Text
                    numberOfLines={12}
                    style={[styles.bodyText, { color: theme.textSecondary, backgroundColor: theme.backgroundElement }]}>
                    {item.body.startsWith('v1:') ? 'Encrypted content' : item.body || '(empty)'}
                  </Text>
                  <Button label="Restore" variant="secondary" onPress={() => restore(item)} />
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>No history yet</Text>
            <Text style={[styles.meta, { color: theme.textSecondary }]}>
              Versions are saved as you edit.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.two, minHeight: TouchTarget + Spacing.two },
  back: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.title },
  list: { padding: Spacing.four, flexGrow: 1 },
  card: { borderRadius: Radii.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, minHeight: TouchTarget, gap: Spacing.two },
  cardTitle: { ...Typography.subtitle, fontSize: 16 },
  meta: { ...Typography.caption },
  body: { padding: Spacing.three, gap: Spacing.three },
  bodyText: { ...Typography.caption, fontSize: 14, lineHeight: 20, padding: Spacing.three, borderRadius: Radii.sm, overflow: 'hidden' },
  empty: { alignItems: 'center', paddingTop: Spacing.eight, gap: Spacing.one },
});
