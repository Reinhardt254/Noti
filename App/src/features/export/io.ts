import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { createNote, listNotes, listTags, listTemplates, updateNote } from '@/features/notes/repository';
import type { Note } from '@/db/schema';

type ExportedNote = Pick<
  Note,
  'id' | 'title' | 'body' | 'pinned' | 'archived' | 'isDaily' | 'dailyDate' | 'encrypted' | 'createdAt' | 'updatedAt'
>;

type ExportPayload = {
  app: 'noti';
  version: 1;
  exportedAt: string;
  notes: ExportedNote[];
  tags: Array<{ name: string; color: string }>;
  templates: Array<{ name: string; body: string }>;
};

async function allNotes() {
  const [active, archived] = await Promise.all([
    listNotes({ archived: false }),
    listNotes({ archived: true }),
  ]);
  return [...active, ...archived];
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function safeName(name: string) {
  return (name || 'untitled').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'untitled';
}

async function writeAndShare(fileName: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
  }
  return file.uri;
}

export async function exportJson() {
  const [notes, tags, templates] = await Promise.all([allNotes(), listTags(), listTemplates()]);
  const payload: ExportPayload = {
    app: 'noti',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      pinned: n.pinned,
      archived: n.archived,
      isDaily: n.isDaily,
      dailyDate: n.dailyDate,
      encrypted: n.encrypted,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
    tags: tags.map((t) => ({ name: t.name, color: t.color })),
    templates: templates.map((t) => ({ name: t.name, body: t.body })),
  };
  const uri = await writeAndShare(
    `noti-export-${stamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  );
  return { count: notes.length, uri };
}

function noteToMarkdown(n: Pick<Note, 'title' | 'body' | 'updatedAt' | 'encrypted'>) {
  const header = `---\ntitle: ${JSON.stringify(n.title || 'Untitled')}\nupdated: ${n.updatedAt}\n---\n\n`;
  return header + (n.encrypted ? '_Encrypted note (not exported in plaintext)_\n' : n.body) + '\n';
}

/** Exports all notes into a single Markdown document, or one note when provided. */
export async function exportMarkdown(note?: Pick<Note, 'title' | 'body' | 'updatedAt' | 'encrypted'>) {
  if (note) {
    await writeAndShare(`${safeName(note.title)}.md`, noteToMarkdown(note), 'text/markdown');
    return { count: 1 };
  }
  const notes = await allNotes();
  const content = notes.map(noteToMarkdown).join('\n\n---\n\n');
  await writeAndShare(`noti-export-${stamp()}.md`, content, 'text/markdown');
  return { count: notes.length };
}

function stripFrontMatter(text: string) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n+/);
  if (!m) return { body: text, title: undefined as string | undefined };
  const t = m[1].match(/^title:\s*(.+)$/m)?.[1];
  let title: string | undefined;
  if (t) {
    try {
      title = JSON.parse(t);
    } catch {
      title = t.replace(/^["']|["']$/g, '');
    }
  }
  return { body: text.slice(m[0].length), title };
}

/** Pick JSON (Noti export) and/or Markdown/text files and import them as new notes. */
export async function importFromPicker(): Promise<{ imported: number; canceled: boolean }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/markdown', 'text/plain', 'text/*'],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return { imported: 0, canceled: true };

  let imported = 0;
  for (const asset of result.assets) {
    const text = await new File(asset.uri).text();
    const isJson = asset.name.toLowerCase().endsWith('.json') || asset.mimeType === 'application/json';
    if (isJson) {
      const parsed = JSON.parse(text) as Partial<ExportPayload>;
      for (const n of parsed.notes ?? []) {
        const created = await createNote({
          title: n.title,
          body: n.body ?? '',
          isDaily: n.isDaily,
          dailyDate: n.dailyDate ?? null,
          encrypted: n.encrypted,
        });
        if (n.pinned || n.archived) {
          await updateNote(
            created.id,
            { pinned: !!n.pinned, archived: !!n.archived },
            { snapshot: false },
          );
        }
        imported += 1;
      }
    } else {
      const { body, title } = stripFrontMatter(text);
      await createNote({ title: title ?? asset.name.replace(/\.(md|markdown|txt)$/i, ''), body });
      imported += 1;
    }
  }
  return { imported, canceled: false };
}
