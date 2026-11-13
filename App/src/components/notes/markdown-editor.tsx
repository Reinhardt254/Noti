import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputSelectionChangeEvent,
} from 'react-native';
import Markdown from 'react-native-markdown-display';

import { Fonts, Radii, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { searchNoteTitles } from '@/features/notes/repository';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  body: string;
  onChangeTitle: (title: string) => void;
  onChangeBody: (body: string) => void;
  /** Called with the zero-based line index of a tapped checklist item in preview. */
  onToggleChecklist?: (lineIndex: number) => void;
  /** Called when a [[wiki link]] is tapped in preview. */
  onOpenWikiLink?: (title: string) => void;
  readOnly?: boolean;
  /** Hide secondary chrome for distraction-free writing. */
  focusMode?: boolean;
  initialMode?: 'edit' | 'preview';
};

type Segment =
  | { type: 'markdown'; text: string }
  | { type: 'check'; lineIndex: number; checked: boolean; text: string };

const CHECK_RE = /^\s*[-*]\s+\[([ xX])\]\s?(.*)$/;

function splitSegments(body: string): Segment[] {
  const segments: Segment[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) {
      segments.push({ type: 'markdown', text: buffer.join('\n') });
      buffer = [];
    }
  };
  body.split('\n').forEach((line, lineIndex) => {
    const m = line.match(CHECK_RE);
    if (m) {
      flush();
      segments.push({
        type: 'check',
        lineIndex,
        checked: m[1].toLowerCase() === 'x',
        text: m[2],
      });
    } else {
      buffer.push(line);
    }
  });
  flush();
  return segments;
}

function wikiToLinks(text: string) {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_m, t: string) => {
    const title = t.trim();
    return `[${title}](wiki://${encodeURIComponent(title)})`;
  });
}

/** Detect an unfinished `[[query` immediately before the caret. */
function wikiQueryAt(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const idx = before.lastIndexOf('[[');
  if (idx === -1) return null;
  const query = before.slice(idx + 2);
  if (query.includes(']') || query.includes('\n')) return null;
  return { query, start: idx + 2 };
}

export function MarkdownEditor({
  title,
  body,
  onChangeTitle,
  onChangeBody,
  onToggleChecklist,
  onOpenWikiLink,
  readOnly,
  focusMode,
  initialMode = 'edit',
}: Props) {
  const theme = useTheme();
  const [mode, setMode] = useState<'edit' | 'preview'>(readOnly ? 'preview' : initialMode);
  const [caret, setCaret] = useState(0);
  const [forcedSelection, setForcedSelection] = useState<{ start: number; end: number } | undefined>();
  const [suggestions, setSuggestions] = useState<Array<{ id: string; title: string }>>([]);
  const bodyRef = useRef<ComponentRef<typeof TextInput>>(null);

  const wiki = useMemo(() => wikiQueryAt(body, caret), [body, caret]);

  useEffect(() => {
    let cancelled = false;
    if (!wiki || mode !== 'edit') {
      setSuggestions([]);
      return;
    }
    searchNoteTitles(wiki.query, 6).then((rows) => {
      if (cancelled) return;
      setSuggestions(rows.filter((r) => r.title && r.title.trim().length > 0));
    });
    return () => {
      cancelled = true;
    };
  }, [wiki, mode]);

  function onSelectionChange(e: TextInputSelectionChangeEvent) {
    setCaret(e.nativeEvent.selection.end);
    if (forcedSelection) setForcedSelection(undefined);
  }

  function pickSuggestion(noteTitle: string) {
    if (!wiki) return;
    const insert = `${noteTitle}]]`;
    const next = body.slice(0, wiki.start) + insert + body.slice(caret);
    const pos = wiki.start + insert.length;
    onChangeBody(next);
    setCaret(pos);
    setForcedSelection({ start: pos, end: pos });
    setSuggestions([]);
    bodyRef.current?.focus();
  }

  const showCreateOption =
    !!wiki &&
    wiki.query.trim().length > 0 &&
    !suggestions.some((s) => s.title.toLowerCase() === wiki.query.trim().toLowerCase());

  const mdStyles = useMemo(
    () => ({
      body: { color: theme.text, fontSize: 16, lineHeight: 26, fontFamily: Fonts.sans },
      heading1: { color: theme.text, ...Typography.title, marginTop: Spacing.three, marginBottom: Spacing.two },
      heading2: { color: theme.text, ...Typography.subtitle, marginTop: Spacing.three, marginBottom: Spacing.one },
      heading3: { color: theme.text, ...Typography.callout, marginTop: Spacing.two },
      link: { color: theme.link },
      blockquote: {
        backgroundColor: theme.backgroundElement,
        borderLeftColor: theme.primary,
        borderLeftWidth: 3,
        paddingHorizontal: Spacing.three,
        marginVertical: Spacing.two,
      },
      code_inline: {
        backgroundColor: theme.codeBg,
        color: theme.text,
        fontFamily: Fonts.mono,
        borderRadius: 4,
      },
      code_block: {
        backgroundColor: theme.codeBg,
        color: theme.text,
        fontFamily: Fonts.mono,
        borderColor: theme.border,
        borderRadius: Radii.sm,
        padding: Spacing.three,
      },
      fence: {
        backgroundColor: theme.codeBg,
        color: theme.text,
        fontFamily: Fonts.mono,
        borderColor: theme.border,
        borderRadius: Radii.sm,
        padding: Spacing.three,
      },
      hr: { backgroundColor: theme.border },
      table: { borderColor: theme.border },
      tr: { borderColor: theme.border },
      th: { borderColor: theme.border },
      td: { borderColor: theme.border },
    }),
    [theme],
  );

  const segments = useMemo(() => splitSegments(body), [body]);

  return (
    <View style={styles.root}>
      {!readOnly ? (
        <View style={[styles.toggle, { backgroundColor: theme.backgroundElement }]}>
          {(['edit', 'preview'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
              style={[styles.toggleBtn, mode === m && { backgroundColor: theme.card }]}>
              <Text
                style={{
                  ...Typography.callout,
                  color: mode === m ? theme.text : theme.textSecondary,
                }}>
                {m === 'edit' ? 'Edit' : 'Preview'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        {mode === 'edit' ? (
          <>
            <TextInput
              value={title}
              onChangeText={onChangeTitle}
              placeholder="Title"
              placeholderTextColor={theme.textMuted}
              selectionColor={theme.primary}
              editable={!readOnly}
              multiline
              blurOnSubmit
              returnKeyType="next"
              onSubmitEditing={() => bodyRef.current?.focus()}
              accessibilityLabel="Note title"
              style={[styles.title, { color: theme.text }]}
            />
            <TextInput
              ref={bodyRef}
              value={body}
              onChangeText={onChangeBody}
              onSelectionChange={onSelectionChange}
              selection={forcedSelection}
              placeholder="Start writing… use [[ to link notes, #tags, - [ ] tasks"
              placeholderTextColor={theme.textMuted}
              selectionColor={theme.primary}
              editable={!readOnly}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              autoCapitalize="sentences"
              accessibilityLabel="Note body"
              style={[
                styles.body,
                { color: theme.text },
                focusMode && styles.bodyFocus,
              ]}
            />
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: theme.text }]}>{title || 'Untitled'}</Text>
            {segments.map((seg, i) =>
              seg.type === 'check' ? (
                <Pressable
                  key={`c${seg.lineIndex}`}
                  onPress={() => onToggleChecklist?.(seg.lineIndex)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: seg.checked }}
                  style={styles.checkRow}>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: seg.checked ? theme.primary : theme.textMuted,
                        backgroundColor: seg.checked ? theme.primary : 'transparent',
                      },
                    ]}>
                    {seg.checked ? (
                      <Text style={{ color: theme.primaryForeground, fontSize: 13, fontWeight: '700' }}>✓</Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.checkText,
                      {
                        color: seg.checked ? theme.textMuted : theme.text,
                        textDecorationLine: seg.checked ? 'line-through' : 'none',
                      },
                    ]}>
                    {seg.text || ' '}
                  </Text>
                </Pressable>
              ) : seg.text.trim() ? (
                <Markdown
                  key={`m${i}`}
                  style={mdStyles}
                  onLinkPress={(url) => {
                    if (url.startsWith('wiki://')) {
                      onOpenWikiLink?.(decodeURIComponent(url.slice(7)));
                      return false;
                    }
                    return true;
                  }}>
                  {wikiToLinks(seg.text)}
                </Markdown>
              ) : null,
            )}
            {!body.trim() ? (
              <Text style={{ color: theme.textMuted, ...Typography.body }}>Nothing to preview yet.</Text>
            ) : null}
          </>
        )}
      </ScrollView>

      {mode === 'edit' && wiki ? (
        <View style={[styles.suggest, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.suggestHint, { color: theme.textMuted }]}>Link to note</Text>
          <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false}>
            <View style={styles.suggestRow}>
              {suggestions.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => pickSuggestion(s.title)}
                  accessibilityRole="button"
                  style={[styles.suggestChip, { backgroundColor: theme.backgroundElement }]}>
                  <Text numberOfLines={1} style={{ color: theme.text, ...Typography.callout }}>
                    {s.title}
                  </Text>
                </Pressable>
              ))}
              {showCreateOption ? (
                <Pressable
                  onPress={() => pickSuggestion(wiki.query.trim())}
                  accessibilityRole="button"
                  style={[styles.suggestChip, { backgroundColor: theme.primary }]}>
                  <Text numberOfLines={1} style={{ color: theme.primaryForeground, ...Typography.callout }}>
                    + {wiki.query.trim()}
                  </Text>
                </Pressable>
              ) : null}
              {!suggestions.length && !showCreateOption ? (
                <Text style={{ color: theme.textMuted, ...Typography.caption }}>Type a note title…</Text>
              ) : null}
            </View>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: Radii.md,
    padding: 3,
    marginBottom: Spacing.two,
  },
  toggleBtn: {
    minHeight: TouchTarget - 8,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.three,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.seven },
  title: { ...Typography.display, fontSize: 28, paddingVertical: Spacing.two },
  body: { fontSize: 16, lineHeight: 26, minHeight: 320, fontFamily: Fonts.sans, paddingTop: Spacing.two },
  bodyFocus: { fontSize: 18, lineHeight: 30 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: TouchTarget,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { flex: 1, fontSize: 16, lineHeight: 24 },
  suggest: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  suggestHint: { ...Typography.label, textTransform: 'uppercase' },
  suggestRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  suggestChip: {
    minHeight: 36,
    maxWidth: 220,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.full,
    justifyContent: 'center',
  },
});
