import { and, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { db, rawDb } from '@/db/client';
import {
  links,
  noteTags,
  noteVersions,
  notes,
  tags,
  templates,
  type Note,
} from '@/db/schema';
import { createId, nowIso, todayKey } from '@/lib/id';
import {
  extractChecklists,
  extractTags,
  extractWikiLinks,
  firstLineTitle,
} from '@/lib/markdown';

const DEFAULT_TEMPLATES = [
  {
    name: 'Meeting notes',
    body: `# Meeting notes\n\n**Date:** \n**Attendees:** \n\n## Agenda\n- [ ] \n\n## Notes\n\n## Action items\n- [ ] \n`,
  },
  {
    name: 'Bug report',
    body: `# Bug report\n\n**Severity:** \n**Environment:** \n\n## Steps to reproduce\n1. \n\n## Expected\n\n## Actual\n\n## Notes\n`,
  },
  {
    name: 'Project idea',
    body: `# Project idea\n\n## Problem\n\n## Solution\n\n## Next steps\n- [ ] \n`,
  },
];

export async function seedTemplates() {
  const existing = await db.select().from(templates).limit(1);
  if (existing.length) return;
  const ts = nowIso();
  for (const t of DEFAULT_TEMPLATES) {
    await db.insert(templates).values({
      id: createId(),
      name: t.name,
      body: t.body,
      createdAt: ts,
      updatedAt: ts,
      dirty: true,
    });
  }
}

export async function listNotes(opts?: {
  archived?: boolean;
  query?: string;
  tag?: string;
}) {
  const archived = opts?.archived ?? false;

  if (opts?.query?.trim()) {
    const q = opts.query.trim().replace(/"/g, '""');
    const rows = rawDb.getAllSync<{ id: string }>(
      `SELECT notes.id FROM notes_fts
       JOIN notes ON notes.rowid = notes_fts.rowid
       WHERE notes_fts MATCH ?
         AND notes.deleted_at IS NULL
         AND notes.archived = ?
         AND notes.encrypted = 0
       ORDER BY rank
       LIMIT 100`,
      [`${q}*`, archived ? 1 : 0],
    );
    const ids = rows.map((r) => r.id);
    if (!ids.length) return [] as Note[];
    const all = await db.select().from(notes).where(isNull(notes.deletedAt));
    const map = new Map(all.map((n) => [n.id, n]));
    return ids.map((id) => map.get(id)).filter(Boolean) as Note[];
  }

  let rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.archived, archived), isNull(notes.deletedAt)))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt));

  if (opts?.tag) {
    const tagName = opts.tag.toLowerCase();
    const tagged = await db
      .select({ noteId: noteTags.noteId, name: tags.name })
      .from(noteTags)
      .innerJoin(tags, eq(tags.id, noteTags.tagId));
    const allowed = new Set(
      tagged.filter((t) => t.name === tagName).map((t) => t.noteId),
    );
    rows = rows.filter((n) => allowed.has(n.id));
  }

  return rows;
}

export async function getNote(id: string) {
  const [note] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  return note ?? null;
}

export async function createNote(input?: {
  title?: string;
  body?: string;
  isDaily?: boolean;
  dailyDate?: string | null;
  encrypted?: boolean;
}) {
  const id = createId();
  const ts = nowIso();
  const body = input?.body ?? '';
  const title = input?.title ?? firstLineTitle(body, '');
  await db.insert(notes).values({
    id,
    title,
    body,
    isDaily: input?.isDaily ?? false,
    dailyDate: input?.dailyDate ?? null,
    encrypted: input?.encrypted ?? false,
    createdAt: ts,
    updatedAt: ts,
    dirty: true,
  });
  if (!input?.encrypted) {
    await syncDerived(id, body, title);
  }
  return (await getNote(id))!;
}

export async function updateNote(
  id: string,
  patch: Partial<{
    title: string;
    body: string;
    pinned: boolean;
    archived: boolean;
    encrypted: boolean;
  }>,
  opts?: { snapshot?: boolean; reason?: string },
) {
  const existing = await getNote(id);
  if (!existing) return null;

  if (opts?.snapshot !== false && (patch.body !== undefined || patch.title !== undefined)) {
    await db.insert(noteVersions).values({
      id: createId(),
      noteId: id,
      title: existing.title,
      body: existing.body,
      reason: opts?.reason ?? 'edit',
      createdAt: nowIso(),
    });
  }

  const title =
    patch.title ??
    (patch.body !== undefined ? firstLineTitle(patch.body, existing.title) : existing.title);

  await db
    .update(notes)
    .set({
      ...patch,
      title,
      updatedAt: nowIso(),
      dirty: true,
    })
    .where(eq(notes.id, id));

  const body = patch.body ?? existing.body;
  if (!(patch.encrypted ?? existing.encrypted)) {
    await syncDerived(id, body, title);
  }
  return getNote(id);
}

export async function softDeleteNote(id: string) {
  await db
    .update(notes)
    .set({ deletedAt: nowIso(), updatedAt: nowIso(), dirty: true })
    .where(eq(notes.id, id));
}

async function syncDerived(noteId: string, body: string, title: string) {
  const tagNames = extractTags(`${title}\n${body}`);
  await db.delete(noteTags).where(eq(noteTags.noteId, noteId));
  for (const name of tagNames) {
    let [tag] = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
    if (!tag) {
      const ts = nowIso();
      const id = createId();
      await db.insert(tags).values({
        id,
        name,
        createdAt: ts,
        updatedAt: ts,
        dirty: true,
      });
      tag = (await db.select().from(tags).where(eq(tags.id, id)))[0];
    }
    await db.insert(noteTags).values({ noteId, tagId: tag.id }).onConflictDoNothing();
  }

  await db.delete(links).where(eq(links.sourceId, noteId));
  for (const targetTitle of extractWikiLinks(body)) {
    const [target] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.title, targetTitle), isNull(notes.deletedAt)))
      .limit(1);
    await db.insert(links).values({
      id: createId(),
      sourceId: noteId,
      targetId: target?.id ?? null,
      targetTitle,
      createdAt: nowIso(),
    });
  }
}

export async function getOrCreateDailyNote() {
  const key = todayKey();
  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.dailyDate, key), isNull(notes.deletedAt)))
    .limit(1);
  if (existing) return existing;
  return createNote({
    title: `Daily · ${key}`,
    body: `# Daily · ${key}\n\n- [ ] \n\n## Journal\n\n`,
    isDaily: true,
    dailyDate: key,
  });
}

export async function listTags() {
  return db
    .select()
    .from(tags)
    .where(isNull(tags.deletedAt))
    .orderBy(tags.name);
}

export async function listTemplates() {
  return db
    .select()
    .from(templates)
    .where(isNull(templates.deletedAt))
    .orderBy(templates.name);
}

export async function backlinksFor(noteId: string) {
  return db
    .select({
      id: links.id,
      sourceId: links.sourceId,
      targetTitle: links.targetTitle,
      title: notes.title,
      updatedAt: notes.updatedAt,
    })
    .from(links)
    .innerJoin(notes, eq(notes.id, links.sourceId))
    .where(and(eq(links.targetId, noteId), isNull(notes.deletedAt)));
}

export async function listVersions(noteId: string) {
  return db
    .select()
    .from(noteVersions)
    .where(eq(noteVersions.noteId, noteId))
    .orderBy(desc(noteVersions.createdAt));
}

export async function restoreVersion(noteId: string, versionId: string) {
  const [version] = await db
    .select()
    .from(noteVersions)
    .where(and(eq(noteVersions.id, versionId), eq(noteVersions.noteId, noteId)))
    .limit(1);
  if (!version) return null;
  return updateNote(
    noteId,
    { title: version.title, body: version.body },
    { reason: 'restore' },
  );
}

export async function graphData() {
  const nodes = await db
    .select({ id: notes.id, title: notes.title, pinned: notes.pinned })
    .from(notes)
    .where(and(isNull(notes.deletedAt), eq(notes.archived, false)));
  const edges = await db.select().from(links);
  return { nodes, edges };
}

export async function openTasksAcrossNotes() {
  const all = await listNotes({ archived: false });
  return all.flatMap((note) =>
    extractChecklists(note.body)
      .filter((item) => !item.checked)
      .map((item) => ({
        noteId: note.id,
        noteTitle: note.title || 'Untitled',
        ...item,
      })),
  );
}

export async function searchNoteTitles(prefix: string, limit = 8) {
  const q = `%${prefix}%`;
  return db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(
      and(
        isNull(notes.deletedAt),
        or(like(notes.title, q), sql`${notes.body} LIKE ${q}`),
      ),
    )
    .limit(limit);
}
