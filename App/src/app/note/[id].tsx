import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkdownEditor } from '@/components/notes/markdown-editor';
import { TagChips } from '@/components/notes/tag-chips';
import { VoiceRecorder } from '@/components/notes/voice-recorder';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radii, Spacing, TouchTarget, Typography } from '@/constants/theme';
import type { Note, Reminder, Template } from '@/db/schema';
import { suggestTags, summarizeNote } from '@/features/ai/client';
import { decryptNoteBody, encryptNoteBody } from '@/features/crypto/notes-crypto';
import { exportMarkdown } from '@/features/export/io';
import {
  backlinksFor,
  createNote,
  getNote,
  listTemplates,
  searchNoteTitles,
  softDeleteNote,
  updateNote,
} from '@/features/notes/repository';
import { completeReminder, listReminders, scheduleReminder } from '@/features/reminders/repository';
import { runSync } from '@/features/sync/engine';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';
import { extractTags, firstLineTitle, toggleChecklistLine } from '@/lib/markdown';

type SheetKind = 'menu' | 'backlinks' | 'templates' | 'reminder' | 'ai' | 'encrypt' | 'voice' | null;
type Backlink = Awaited<ReturnType<typeof backlinksFor>>[number];

const SNAPSHOT_INTERVAL_MS = 60_000;

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { data: session } = authClient.useSession();

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [passphrase, setPassphrase] = useState<string | null>(null);
  const [unlockInput, setUnlockInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [focusMode, setFocusMode] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [aiBusy, setAiBusy] = useState<'summary' | 'tags' | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  // ---- autosave plumbing --------------------------------------------------
  const latest = useRef({ title: '', body: '', passphrase: null as string | null, encrypted: false });
  const dirtyRef = useRef(false);
  const lastSnapshot = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const loaded = useRef(false);

  useEffect(() => {
    latest.current = {
      title,
      body,
      passphrase,
      encrypted: !!note?.encrypted,
    };
  });

  const persist = useCallback(async () => {
    if (!id || !dirtyRef.current) return;
    const snap = latest.current;
    dirtyRef.current = false;
    setSaveState('saving');
    try {
      const now = Date.now();
      const doSnapshot = now - lastSnapshot.current > SNAPSHOT_INTERVAL_MS;
      let patch: { title: string; body: string };
      if (snap.encrypted) {
        if (!snap.passphrase) return;
        patch = {
          title: snap.title,
          body: await encryptNoteBody(snap.body, snap.passphrase),
        };
      } else {
        patch = { title: snap.title.trim() || firstLineTitle(snap.body, ''), body: snap.body };
      }
      const updated = await updateNote(id, patch, { snapshot: doSnapshot, reason: 'edit' });
      if (doSnapshot) lastSnapshot.current = now;
      if (updated) setNote((prev) => (prev ? { ...prev, updatedAt: updated.updatedAt } : prev));
      setSaveState(dirtyRef.current ? 'dirty' : 'saved');
    } catch {
      dirtyRef.current = true;
      setSaveState('dirty');
    }
  }, [id]);

  const flush = useCallback(() => {
    queue.current = queue.current.then(persist);
    return queue.current;
  }, [persist]);

  // Load note
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const n = id ? await getNote(id) : null;
      if (cancelled) return;
      setNote(n);
      if (n) {
        setTitle(n.title);
        setBody(n.encrypted ? '' : n.body);
      }
      loaded.current = true;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Refresh when returning (e.g. after restoring a version) if nothing is pending
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (!id || dirtyRef.current) return;
      getNote(id).then((n) => {
        if (!n || n.encrypted) return;
        setNote(n);
        setTitle(n.title);
        setBody(n.body);
      });
    }, [id]),
  );

  // Debounced autosave (500ms)
  useEffect(() => {
    if (!loaded.current || !note) return;
    if (note.encrypted && !passphrase) return;
    if (!dirtyRef.current) return;
    setSaveState('dirty');
    const h = setTimeout(flush, 500);
    return () => clearTimeout(h);
  }, [title, body, note, passphrase, flush]);

  // Flush pending edits on unmount
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  const onChangeTitle = (t: string) => {
    dirtyRef.current = true;
    setTitle(t);
  };
  const onChangeBody = (b: string) => {
    dirtyRef.current = true;
    setBody(b);
  };

  // ---- derived -------------------------------------------------------------
  const locked = !!note?.encrypted && passphrase === null;
  const tagNames = useMemo(
    () => (note?.encrypted ? [] : extractTags(`${title}\n${body}`)),
    [note?.encrypted, title, body],
  );

  // ---- actions -------------------------------------------------------------
  async function goBack() {
    await flush();
    if (note && !note.encrypted && !note.isDaily && !title.trim() && !body.trim()) {
      await softDeleteNote(note.id);
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function togglePin() {
    if (!note) return;
    const updated = await updateNote(note.id, { pinned: !note.pinned }, { snapshot: false });
    if (updated) setNote(updated);
  }

  async function toggleArchive() {
    if (!note) return;
    const updated = await updateNote(note.id, { archived: !note.archived }, { snapshot: false });
    if (updated) setNote(updated);
    setSheet(null);
  }

  function confirmDelete() {
    setSheet(null);
    Alert.alert('Delete note?', 'This note will be removed from all your devices after sync.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!note) return;
          dirtyRef.current = false;
          await softDeleteNote(note.id);
          if (router.canGoBack()) router.back();
          else router.replace('/');
        },
      },
    ]);
  }

  async function unlock() {
    if (!note || !unlockInput) return;
    setBusy(true);
    setUnlockError(null);
    try {
      const plain = await decryptNoteBody(note.body, unlockInput);
      setBody(plain);
      setPassphrase(unlockInput);
      setUnlockInput('');
    } catch {
      setUnlockError('Wrong passphrase.');
    } finally {
      setBusy(false);
    }
  }

  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [encryptError, setEncryptError] = useState<string | null>(null);

  async function enableEncryption() {
    if (!note) return;
    if (newPass.length < 6) return setEncryptError('Use at least 6 characters.');
    if (newPass !== newPass2) return setEncryptError('Passphrases do not match.');
    setBusy(true);
    setEncryptError(null);
    try {
      const cipher = await encryptNoteBody(body, newPass);
      const updated = await updateNote(
        note.id,
        { title, body: cipher, encrypted: true },
        { snapshot: false },
      );
      if (updated) {
        dirtyRef.current = false;
        setNote(updated);
        setPassphrase(newPass);
        setNewPass('');
        setNewPass2('');
        setSheet(null);
      }
    } catch (e) {
      setEncryptError(e instanceof Error ? e.message : 'Encryption failed');
    } finally {
      setBusy(false);
    }
  }

  function disableEncryption() {
    setSheet(null);
    Alert.alert('Remove encryption?', 'The note will be stored as readable text.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (!note) return;
          const updated = await updateNote(
            note.id,
            { title: title.trim() || firstLineTitle(body, ''), body, encrypted: false },
            { snapshot: false },
          );
          if (updated) {
            dirtyRef.current = false;
            setNote(updated);
            setPassphrase(null);
          }
        },
      },
    ]);
  }

  async function openSheet(kind: SheetKind) {
    if (!note) return;
    if (kind === 'backlinks') setBacklinks(await backlinksFor(note.id));
    if (kind === 'templates') setTemplates(await listTemplates());
    if (kind === 'reminder') setReminders(await listReminders(note.id));
    setSheet(kind);
  }

  function insertTemplate(t: Template) {
    const next = body.trim() ? `${body.replace(/\s+$/, '')}\n\n${t.body}` : t.body;
    onChangeBody(next);
    if (!title.trim()) onChangeTitle(firstLineTitle(t.body, ''));
    setSheet(null);
  }

  async function addReminder(date: Date) {
    if (!note) return;
    try {
      await scheduleReminder(note.id, date, title || 'Note reminder');
      setReminders(await listReminders(note.id));
    } catch (e) {
      Alert.alert('Reminder failed', e instanceof Error ? e.message : 'Could not schedule reminder');
    }
  }

  async function ensureSyncedForAi() {
    if (!session) throw new Error('Sign in (Settings) to use AI features.');
    if (note?.encrypted) throw new Error('AI is unavailable for encrypted notes.');
    await flush();
    const res = await runSync();
    if (!res.ok) throw new Error(res.message);
  }

  async function runSummary() {
    if (!note) return;
    setAiBusy('summary');
    setAiError(null);
    try {
      await ensureSyncedForAi();
      const res = await summarizeNote(note.id);
      setAiSummary(res.summary);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Summarize failed');
    } finally {
      setAiBusy(null);
    }
  }

  async function runSuggestTags() {
    if (!note) return;
    setAiBusy('tags');
    setAiError(null);
    try {
      await ensureSyncedForAi();
      const res = await suggestTags(note.id);
      setAiTags(res.tags);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Suggest tags failed');
    } finally {
      setAiBusy(null);
    }
  }

  function addTag(tag: string) {
    if (tagNames.includes(tag.toLowerCase())) return;
    onChangeBody(`${body.replace(/\s+$/, '')}\n\n#${tag.replace(/^#/, '')}`);
  }

  function insertSummary() {
    if (!aiSummary) return;
    onChangeBody(`> **Summary:** ${aiSummary}\n\n${body}`);
    setSheet(null);
  }

  async function openWikiLink(linkTitle: string) {
    const matches = await searchNoteTitles(linkTitle, 10);
    const exact = matches.find((m) => m.title.toLowerCase() === linkTitle.toLowerCase());
    await flush();
    const target = exact ?? (await createNote({ title: linkTitle, body: `# ${linkTitle}\n\n` }));
    router.push({ pathname: '/note/[id]', params: { id: target.id } });
  }

  function toggleChecklist(lineIndex: number) {
    onChangeBody(toggleChecklistLine(body, lineIndex));
  }

  // ---- render --------------------------------------------------------------
  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!note) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.lockTitle, { color: theme.text }]}>Note not found</Text>
        <Button label="Go back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const saveLabel = saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Editing…';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {focusMode ? (
        <Pressable
          onPress={() => setFocusMode(false)}
          accessibilityRole="button"
          accessibilityLabel="Exit focus mode"
          style={[styles.exitFocus, { backgroundColor: theme.backgroundElement }]}>
          <Text style={{ color: theme.textSecondary, ...Typography.callout }}>Exit focus</Text>
        </Pressable>
      ) : (
        <View style={styles.header}>
          <HeaderButton label="Back" glyph="‹" onPress={goBack} large />
          <View style={styles.headerMid}>
            <Text style={[styles.saveLabel, { color: theme.textMuted }]}>
              {note.encrypted ? '🔒 ' : ''}
              {saveLabel}
            </Text>
          </View>
          <HeaderButton
            label={note.pinned ? 'Unpin' : 'Pin'}
            glyph={note.pinned ? '★' : '☆'}
            onPress={togglePin}
            color={note.pinned ? theme.pin : undefined}
          />
          <HeaderButton label="Focus mode" glyph="◐" onPress={() => setFocusMode(true)} />
          <HeaderButton label="More" glyph="⋯" onPress={() => setSheet('menu')} />
        </View>
      )}

      {locked ? (
        <View style={styles.lock}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.lockTitle, { color: theme.text }]}>This note is encrypted</Text>
          <Text style={[styles.lockBody, { color: theme.textSecondary }]}>
            Enter your passphrase to read and edit it. It never leaves this device.
          </Text>
          <TextField
            value={unlockInput}
            onChangeText={setUnlockInput}
            placeholder="Passphrase"
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={unlock}
            error={unlockError}
          />
          <Button label="Unlock" onPress={unlock} loading={busy} fullWidth />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <MarkdownEditor
            title={title}
            body={body}
            onChangeTitle={onChangeTitle}
            onChangeBody={onChangeBody}
            onToggleChecklist={toggleChecklist}
            onOpenWikiLink={openWikiLink}
            focusMode={focusMode}
          />
          {!focusMode ? (
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <TagChips tags={tagNames.slice(0, 5)} scroll small />
              </View>
              <Pressable
                onPress={() => openSheet('backlinks')}
                accessibilityRole="button"
                style={styles.footerBtn}>
                <Text style={{ color: theme.primary, ...Typography.callout }}>Backlinks</Text>
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      )}

      {/* ---- Sheets ---- */}
      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title="Note">
        <MenuItem label="Insert template" onPress={() => openSheet('templates')} />
        <MenuItem label="Backlinks" onPress={() => openSheet('backlinks')} />
        <MenuItem
          label="Version history"
          onPress={() => {
            setSheet(null);
            router.push({ pathname: '/history/[id]', params: { id: note.id } });
          }}
        />
        <MenuItem label="Reminder" onPress={() => openSheet('reminder')} />
        <MenuItem label="Voice note" onPress={() => openSheet('voice')} disabled={locked} />
        <MenuItem label="AI summarize & tags" onPress={() => openSheet('ai')} disabled={note.encrypted} />
        <MenuItem
          label={note.encrypted ? 'Remove encryption' : 'Encrypt with passphrase'}
          onPress={() => (note.encrypted ? disableEncryption() : openSheet('encrypt'))}
          disabled={note.encrypted && locked}
        />
        <MenuItem
          label="Export as Markdown"
          onPress={async () => {
            setSheet(null);
            await flush();
            await exportMarkdown({
              title,
              body,
              updatedAt: note.updatedAt,
              encrypted: false,
            });
          }}
          disabled={locked}
        />
        <MenuItem label={note.archived ? 'Unarchive' : 'Archive'} onPress={toggleArchive} />
        <MenuItem label="Delete" onPress={confirmDelete} danger />
      </Sheet>

      <Sheet visible={sheet === 'backlinks'} onClose={() => setSheet(null)} title="Backlinks">
        {backlinks.length === 0 ? (
          <Text style={[styles.sheetEmpty, { color: theme.textSecondary }]}>
            No notes link here yet. Use [[{title || 'this note'}]] in another note.
          </Text>
        ) : (
          backlinks.map((b) => (
            <MenuItem
              key={b.id}
              label={b.title || 'Untitled'}
              onPress={async () => {
                setSheet(null);
                await flush();
                router.push({ pathname: '/note/[id]', params: { id: b.sourceId } });
              }}
            />
          ))
        )}
      </Sheet>

      <Sheet visible={sheet === 'templates'} onClose={() => setSheet(null)} title="Insert template">
        {templates.length === 0 ? (
          <Text style={[styles.sheetEmpty, { color: theme.textSecondary }]}>No templates yet.</Text>
        ) : (
          templates.map((t) => <MenuItem key={t.id} label={t.name} onPress={() => insertTemplate(t)} />)
        )}
      </Sheet>

      <Sheet visible={sheet === 'reminder'} onClose={() => setSheet(null)} title="Reminder">
        {reminders
          .filter((r) => !r.done)
          .map((r) => (
            <View key={r.id} style={styles.reminderRow}>
              <Text style={{ color: theme.text, ...Typography.body, flex: 1 }}>
                {new Date(r.remindAt).toLocaleString()}
              </Text>
              <Button
                label="Cancel"
                variant="danger"
                onPress={async () => {
                  await completeReminder(r.id);
                  setReminders(await listReminders(note.id));
                }}
              />
            </View>
          ))}
        <Text style={[styles.sheetLabel, { color: theme.textMuted }]}>REMIND ME</Text>
        <MenuItem label="In 1 hour" onPress={() => addReminder(new Date(Date.now() + 3600_000))} />
        <MenuItem label="This evening (6 PM)" onPress={() => addReminder(atHour(18))} />
        <MenuItem label="Tomorrow morning (9 AM)" onPress={() => addReminder(atHour(9, 1))} />
        <MenuItem label="In 1 week" onPress={() => addReminder(atHour(9, 7))} />
      </Sheet>

      <Sheet visible={sheet === 'voice'} onClose={() => setSheet(null)} title="Voice note">
        <VoiceRecorder
          onRecorded={(snippet) => {
            onChangeBody(`${body}${snippet}`);
            setSheet(null);
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'ai'} onClose={() => setSheet(null)} title="AI">

        <View style={styles.aiActions}>
          <Button
            label="Summarize"
            variant="secondary"
            loading={aiBusy === 'summary'}
            onPress={runSummary}
            style={{ flex: 1 }}
          />
          <Button
            label="Suggest tags"
            variant="secondary"
            loading={aiBusy === 'tags'}
            onPress={runSuggestTags}
            style={{ flex: 1 }}
          />
        </View>
        {aiError ? <Text style={{ color: theme.danger, ...Typography.caption }}>{aiError}</Text> : null}
        {aiSummary ? (
          <View style={[styles.aiCard, { backgroundColor: theme.backgroundElement }]}>
            <Text style={{ color: theme.text, ...Typography.body }}>{aiSummary}</Text>
            <Button label="Insert at top" variant="ghost" onPress={insertSummary} />
          </View>
        ) : null}
        {aiTags.length ? (
          <View style={{ gap: Spacing.two }}>
            <Text style={[styles.sheetLabel, { color: theme.textMuted }]}>TAP TO ADD</Text>
            <TagChips tags={aiTags} onSelect={(t) => t && addTag(t)} />
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'encrypt'} onClose={() => setSheet(null)} title="Encrypt note">
        <Text style={{ color: theme.textSecondary, ...Typography.caption }}>
          The body is encrypted on this device (AES-GCM). If you forget the passphrase, the note cannot be
          recovered. Encrypted notes are excluded from search and AI.
        </Text>
        <TextField
          label="Passphrase"
          value={newPass}
          onChangeText={setNewPass}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextField
          label="Confirm"
          value={newPass2}
          onChangeText={setNewPass2}
          secureTextEntry
          autoCapitalize="none"
          error={encryptError}
        />
        <Button label="Encrypt" onPress={enableEncryption} loading={busy} fullWidth />
      </Sheet>
    </SafeAreaView>
  );
}

function atHour(hour: number, addDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function HeaderButton({
  glyph,
  label,
  onPress,
  color,
  large,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
  color?: string;
  large?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.headerBtn}>
      <Text style={{ color: color ?? theme.text, fontSize: large ? 32 : 20, lineHeight: large ? 34 : 24 }}>
        {glyph}
      </Text>
    </Pressable>
  );
}

function MenuItem({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.menuItem,
        { opacity: disabled ? 0.4 : 1, backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
      ]}>
      <Text style={{ color: danger ? theme.danger : theme.text, ...Typography.subtitle, fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: theme.overlay }]} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.headerBtn}>
              <Text style={{ color: theme.textSecondary, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.sheetBody}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 480 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    minHeight: TouchTarget + Spacing.two,
  },
  headerMid: { flex: 1, paddingHorizontal: Spacing.two },
  headerBtn: {
    width: TouchTarget,
    height: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { ...Typography.caption },
  exitFocus: {
    alignSelf: 'flex-end',
    margin: Spacing.three,
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.full,
    justifyContent: 'center',
    opacity: 0.7,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingLeft: Spacing.four,
    minHeight: TouchTarget,
  },
  footerBtn: { minHeight: TouchTarget, paddingHorizontal: Spacing.four, justifyContent: 'center' },
  lock: { flex: 1, padding: Spacing.five, gap: Spacing.three, justifyContent: 'center' },
  lockIcon: { fontSize: 40, textAlign: 'center' },
  lockTitle: { ...Typography.title, textAlign: 'center' },
  lockBody: { ...Typography.body, textAlign: 'center' },
  overlay: { flex: 1 },
  sheet: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.five,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Spacing.five,
    paddingRight: Spacing.two,
    paddingTop: Spacing.two,
  },
  sheetTitle: { ...Typography.subtitle },
  sheetBody: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  sheetEmpty: { ...Typography.body, padding: Spacing.three },
  sheetLabel: { ...Typography.label, marginTop: Spacing.three, paddingHorizontal: Spacing.three },
  menuItem: {
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: Radii.sm,
  },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  aiActions: { flexDirection: 'row', gap: Spacing.two },
  aiCard: { padding: Spacing.three, borderRadius: Radii.md, gap: Spacing.two },
});
