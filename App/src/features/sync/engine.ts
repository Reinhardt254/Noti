import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { notes, reminders, syncState, tags, templates } from '@/db/schema';
import { apiFetch } from '@/lib/api';

type PushResult = {
  serverVersion: number;
  conflicts: Array<{ id: string; type: string; reason: string }>;
};

type PullResult = {
  serverVersion: number;
  notes: Array<Record<string, unknown>>;
  tags: Array<Record<string, unknown>>;
  templates: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
};

let syncing = false;

export async function getSyncCursor() {
  const [row] = await db.select().from(syncState).limit(1);
  if (row) return row;
  await db.insert(syncState).values({ lastPulledVersion: 0 });
  const [created] = await db.select().from(syncState).limit(1);
  return created;
}

export async function runSync(): Promise<{
  ok: boolean;
  message: string;
  conflicts?: PushResult['conflicts'];
}> {
  if (syncing) return { ok: true, message: 'Sync already running' };
  syncing = true;
  try {
    const cursor = await getSyncCursor();
    const dirtyNotes = await db.select().from(notes).where(eq(notes.dirty, true));
    const dirtyTags = await db.select().from(tags).where(eq(tags.dirty, true));
    const dirtyTemplates = await db
      .select()
      .from(templates)
      .where(eq(templates.dirty, true));
    const dirtyReminders = await db
      .select()
      .from(reminders)
      .where(eq(reminders.dirty, true));

    const push = await apiFetch<PushResult>('/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        notes: dirtyNotes.map((n) => ({
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
          deletedAt: n.deletedAt,
        })),
        tags: dirtyTags.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          deletedAt: t.deletedAt,
        })),
        templates: dirtyTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          body: t.body,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          deletedAt: t.deletedAt,
        })),
        reminders: dirtyReminders.map((r) => ({
          id: r.id,
          noteId: r.noteId,
          remindAt: r.remindAt,
          notificationId: r.notificationId,
          done: r.done,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          deletedAt: r.deletedAt,
        })),
      }),
    });

    for (const n of dirtyNotes) {
      await db.update(notes).set({ dirty: false }).where(eq(notes.id, n.id));
    }
    for (const t of dirtyTags) {
      await db.update(tags).set({ dirty: false }).where(eq(tags.id, t.id));
    }
    for (const t of dirtyTemplates) {
      await db.update(templates).set({ dirty: false }).where(eq(templates.id, t.id));
    }
    for (const r of dirtyReminders) {
      await db.update(reminders).set({ dirty: false }).where(eq(reminders.id, r.id));
    }

    const pull = await apiFetch<PullResult>(
      `/sync/pull?since=${cursor.lastPulledVersion}`,
    );

    for (const n of pull.notes) {
      await upsertNoteFromServer(n);
    }
    for (const t of pull.tags) {
      await upsertTagFromServer(t);
    }
    for (const t of pull.templates) {
      await upsertTemplateFromServer(t);
    }
    for (const r of pull.reminders) {
      await upsertReminderFromServer(r);
    }

    await db
      .update(syncState)
      .set({
        lastPulledVersion: pull.serverVersion || push.serverVersion,
        lastSyncedAt: new Date().toISOString(),
      })
      .where(eq(syncState.id, cursor.id));

    return {
      ok: true,
      message: 'Synced',
      conflicts: push.conflicts,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Sync failed',
    };
  } finally {
    syncing = false;
  }
}

async function upsertNoteFromServer(n: Record<string, unknown>) {
  const id = String(n.id);
  const [existing] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  const row = {
    id,
    userId: n.userId ? String(n.userId) : null,
    title: String(n.title ?? ''),
    body: String(n.body ?? ''),
    pinned: Boolean(n.pinned),
    archived: Boolean(n.archived),
    isDaily: Boolean(n.isDaily),
    dailyDate: n.dailyDate ? String(n.dailyDate) : null,
    encrypted: Boolean(n.encrypted),
    createdAt: toIso(n.createdAt),
    updatedAt: toIso(n.updatedAt),
    deletedAt: n.deletedAt ? toIso(n.deletedAt) : null,
    version: Number(n.version ?? 0),
    dirty: false,
  };
  if (!existing) {
    await db.insert(notes).values(row);
  } else if (!existing.dirty) {
    await db.update(notes).set(row).where(eq(notes.id, id));
  }
}

async function upsertTagFromServer(t: Record<string, unknown>) {
  const id = String(t.id);
  const [existing] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  const row = {
    id,
    userId: t.userId ? String(t.userId) : null,
    name: String(t.name ?? ''),
    color: String(t.color ?? '#6366F1'),
    createdAt: toIso(t.createdAt),
    updatedAt: toIso(t.updatedAt),
    deletedAt: t.deletedAt ? toIso(t.deletedAt) : null,
    version: Number(t.version ?? 0),
    dirty: false,
  };
  if (!existing) await db.insert(tags).values(row);
  else if (!existing.dirty) await db.update(tags).set(row).where(eq(tags.id, id));
}

async function upsertTemplateFromServer(t: Record<string, unknown>) {
  const id = String(t.id);
  const [existing] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1);
  const row = {
    id,
    userId: t.userId ? String(t.userId) : null,
    name: String(t.name ?? ''),
    body: String(t.body ?? ''),
    createdAt: toIso(t.createdAt),
    updatedAt: toIso(t.updatedAt),
    deletedAt: t.deletedAt ? toIso(t.deletedAt) : null,
    version: Number(t.version ?? 0),
    dirty: false,
  };
  if (!existing) await db.insert(templates).values(row);
  else if (!existing.dirty)
    await db.update(templates).set(row).where(eq(templates.id, id));
}

async function upsertReminderFromServer(r: Record<string, unknown>) {
  const id = String(r.id);
  const [existing] = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, id))
    .limit(1);
  const row = {
    id,
    noteId: String(r.noteId),
    remindAt: toIso(r.remindAt),
    notificationId: r.notificationId ? String(r.notificationId) : null,
    done: Boolean(r.done),
    createdAt: toIso(r.createdAt),
    updatedAt: toIso(r.updatedAt),
    deletedAt: r.deletedAt ? toIso(r.deletedAt) : null,
    version: Number(r.version ?? 0),
    dirty: false,
  };
  if (!existing) await db.insert(reminders).values(row);
  else if (!existing.dirty)
    await db.update(reminders).set(row).where(eq(reminders.id, id));
}

function toIso(value: unknown) {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return new Date(String(value)).toISOString();
}

export async function countDirty() {
  const dirtyNotes = await db
    .select()
    .from(notes)
    .where(and(eq(notes.dirty, true), isNull(notes.deletedAt)));
  return dirtyNotes.length;
}
