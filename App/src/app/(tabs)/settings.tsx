import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SyncStatus } from '@/components/sync-status';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { askNotes, clipUrl } from '@/features/ai/client';
import { exportJson, exportMarkdown, importFromPicker } from '@/features/export/io';
import { runSync } from '@/features/sync/engine';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

type Source = { id: string; title: string };

export default function SettingsScreen() {
  const theme = useTheme();
  const { data: session } = authClient.useSession();

  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncKey, setSyncKey] = useState(0);

  const [exportBusy, setExportBusy] = useState<'json' | 'md' | 'import' | null>(null);

  const [clipInput, setClipInput] = useState('');
  const [clipBusy, setClipBusy] = useState(false);
  const [clipMsg, setClipMsg] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [askBusy, setAskBusy] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  async function sync() {
    setSyncBusy(true);
    setSyncMsg(null);
    const res = await runSync();
    setSyncMsg(
      res.ok
        ? res.conflicts?.length
          ? `Synced with ${res.conflicts.length} conflict(s) resolved on the server.`
          : 'Everything is up to date.'
        : res.message,
    );
    setSyncKey((k) => k + 1);
    setSyncBusy(false);
  }

  async function signOut() {
    await authClient.signOut();
    setSyncMsg(null);
    setSyncKey((k) => k + 1);
  }

  async function runExport(kind: 'json' | 'md') {
    setExportBusy(kind);
    try {
      const res = kind === 'json' ? await exportJson() : await exportMarkdown();
      Alert.alert('Export ready', `${res.count} note(s) exported.`);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setExportBusy(null);
    }
  }

  async function runImport() {
    setExportBusy('import');
    try {
      const res = await importFromPicker();
      if (!res.canceled) Alert.alert('Import complete', `${res.imported} note(s) imported.`);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setExportBusy(null);
    }
  }

  async function clip() {
    const url = clipInput.trim();
    if (!url) return;
    setClipBusy(true);
    setClipMsg(null);
    try {
      const res = await clipUrl(url);
      setClipInput('');
      setClipMsg(`Clipped “${res.title}”. Sync to see it in Notes.`);
      await runSync();
      setSyncKey((k) => k + 1);
    } catch (e) {
      setClipMsg(e instanceof Error ? e.message : 'Could not clip URL');
    } finally {
      setClipBusy(false);
    }
  }

  async function ask() {
    const q = question.trim();
    if (!q) return;
    setAskBusy(true);
    setAskError(null);
    setAnswer('');
    setSources([]);
    try {
      await askNotes(q, (event) => {
        if (event.token) setAnswer((a) => a + event.token);
        if (event.sources) setSources(event.sources);
      });
    } catch (e) {
      setAskError(e instanceof Error ? e.message : 'Could not reach AI');
    } finally {
      setAskBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

        <Section title="Account & sync">
          <SyncStatus refreshKey={syncKey} />
          {session ? (
            <View style={styles.row}>
              <Button label="Sync now" onPress={sync} loading={syncBusy} style={styles.flex} />
              <Button label="Sign out" variant="secondary" onPress={signOut} style={styles.flex} />
            </View>
          ) : (
            <View style={styles.row}>
              <Button label="Sign in" onPress={() => router.push('/sign-in')} style={styles.flex} />
              <Button label="Create account" variant="secondary" onPress={() => router.push('/sign-up')} style={styles.flex} />
            </View>
          )}
          {syncMsg ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{syncMsg}</Text> : null}
        </Section>

        <Section title="Appearance">
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Noti follows your system light / dark setting automatically.
          </Text>
        </Section>

        <Section title="Export & import">
          <View style={styles.row}>
            <Button
              label="Export JSON"
              variant="secondary"
              loading={exportBusy === 'json'}
              onPress={() => runExport('json')}
              style={styles.flex}
            />
            <Button
              label="Export Markdown"
              variant="secondary"
              loading={exportBusy === 'md'}
              onPress={() => runExport('md')}
              style={styles.flex}
            />
          </View>
          <Button
            label="Import JSON / Markdown"
            variant="secondary"
            loading={exportBusy === 'import'}
            onPress={runImport}
            fullWidth
          />
        </Section>

        <Section title="Web clipper">
          <TextField
            value={clipInput}
            onChangeText={setClipInput}
            placeholder="https://example.com/article"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={clip}
          />
          <Button label="Clip to notes" onPress={clip} loading={clipBusy} disabled={!session} fullWidth />
          {!session ? <Text style={[styles.hint, { color: theme.textMuted }]}>Sign in to clip pages.</Text> : null}
          {clipMsg ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{clipMsg}</Text> : null}
        </Section>

        <Section title="Ask your notes">
          <TextField
            value={question}
            onChangeText={setQuestion}
            placeholder="What did I decide about…?"
            onSubmitEditing={ask}
            returnKeyType="send"
          />
          <Button label="Ask AI" onPress={ask} loading={askBusy} disabled={!session} fullWidth />
          {!session ? <Text style={[styles.hint, { color: theme.textMuted }]}>Sign in to use AI.</Text> : null}
          {askError ? <Text style={[styles.hint, { color: theme.danger }]}>{askError}</Text> : null}
          {answer ? (
            <View style={[styles.answer, { backgroundColor: theme.backgroundElement }]}>
              <Text style={{ color: theme.text, ...Typography.body }}>{answer}</Text>
              {sources.length ? (
                <View style={{ gap: Spacing.one, marginTop: Spacing.two }}>
                  <Text style={[styles.sourceLabel, { color: theme.textMuted }]}>SOURCES</Text>
                  {sources.map((s) => (
                    <Text
                      key={s.id}
                      onPress={() => router.push({ pathname: '/note/[id]', params: { id: s.id } })}
                      style={{ color: theme.link, ...Typography.callout }}>
                      {s.title || 'Untitled'}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </Section>

        <Text style={[styles.version, { color: theme.textMuted }]}>Noti · local-first notes</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.four },
  title: { ...Typography.display },
  section: { gap: Spacing.two },
  sectionTitle: { ...Typography.label, paddingHorizontal: Spacing.one },
  card: {
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  hint: { ...Typography.caption },
  answer: { padding: Spacing.three, borderRadius: Radii.md },
  sourceLabel: { ...Typography.label },
  version: { ...Typography.caption, textAlign: 'center' },
});
