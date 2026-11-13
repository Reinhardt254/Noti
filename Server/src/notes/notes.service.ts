import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/db.module';
import { links, noteTags, noteVersions, notes, tags } from '../db/schema';

@Injectable()
export class NotesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(userId: string, opts?: { archived?: boolean; q?: string }) {
    const archived = opts?.archived ?? false;
    if (opts?.q?.trim()) {
      return this.search(userId, opts.q, archived);
    }

    return this.db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          eq(notes.archived, archived),
          isNull(notes.deletedAt),
          eq(notes.encrypted, false),
        ),
      )
      .orderBy(desc(notes.pinned), desc(notes.updatedAt));
  }

  async search(userId: string, query: string, archived = false, limit = 50) {
    const q = query.trim();
    return this.db
      .select({
        id: notes.id,
        userId: notes.userId,
        title: notes.title,
        body: notes.body,
        pinned: notes.pinned,
        archived: notes.archived,
        isDaily: notes.isDaily,
        dailyDate: notes.dailyDate,
        encrypted: notes.encrypted,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        deletedAt: notes.deletedAt,
        version: notes.version,
        rank: sql<number>`ts_rank(${notes.searchVector}, websearch_to_tsquery('english', ${q}))`,
      })
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          eq(notes.archived, archived),
          isNull(notes.deletedAt),
          eq(notes.encrypted, false),
          sql`${notes.searchVector} @@ websearch_to_tsquery('english', ${q})`,
        ),
      )
      .orderBy(
        sql`ts_rank(${notes.searchVector}, websearch_to_tsquery('english', ${q})) DESC`,
      )
      .limit(limit);
  }

  async get(userId: string, id: string) {
    const [note] = await this.db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);
    if (!note) throw new NotFoundException('Note not found');
    return note;
  }

  async create(
    userId: string,
    data: {
      id?: string;
      title?: string;
      body?: string;
      pinned?: boolean;
      archived?: boolean;
      isDaily?: boolean;
      dailyDate?: string | null;
      encrypted?: boolean;
    },
  ) {
    const [note] = await this.db
      .insert(notes)
      .values({
        id: data.id,
        userId,
        title: data.title ?? '',
        body: data.body ?? '',
        pinned: data.pinned ?? false,
        archived: data.archived ?? false,
        isDaily: data.isDaily ?? false,
        dailyDate: data.dailyDate ?? null,
        encrypted: data.encrypted ?? false,
        version: 1,
      })
      .returning();
    await this.refreshSearchVector(note.id);
    return note;
  }

  async update(
    userId: string,
    id: string,
    data: Partial<{
      title: string;
      body: string;
      pinned: boolean;
      archived: boolean;
      encrypted: boolean;
    }>,
    opts?: { snapshot?: boolean; reason?: string },
  ) {
    const existing = await this.get(userId, id);
    if (opts?.snapshot !== false) {
      await this.db.insert(noteVersions).values({
        noteId: existing.id,
        userId,
        title: existing.title,
        body: existing.body,
        reason: opts?.reason ?? 'edit',
      });
    }

    const [updated] = await this.db
      .update(notes)
      .set({
        ...data,
        updatedAt: new Date(),
        version: sql`${notes.version} + 1`,
      })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();

    if (!updated.encrypted) {
      await this.refreshSearchVector(id);
    } else {
      await this.db
        .update(notes)
        .set({ searchVector: null })
        .where(eq(notes.id, id));
    }
    return updated;
  }

  async softDelete(userId: string, id: string) {
    await this.get(userId, id);
    const [deleted] = await this.db
      .update(notes)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        version: sql`${notes.version} + 1`,
        searchVector: null,
      })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();
    return deleted;
  }

  async refreshSearchVector(noteId: string) {
    await this.db.execute(sql`
      UPDATE notes
      SET search_vector =
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(body, '')), 'B')
      WHERE id = ${noteId} AND encrypted = false AND deleted_at IS NULL
    `);
  }

  async rebuildLinks(userId: string, noteId: string, body: string) {
    await this.db.delete(links).where(eq(links.sourceId, noteId));
    const titles = [...body.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
    if (!titles.length) return [];

    const created = [];
    for (const targetTitle of titles) {
      const [target] = await this.db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            eq(notes.title, targetTitle),
            isNull(notes.deletedAt),
            ne(notes.id, noteId),
          ),
        )
        .limit(1);

      const [link] = await this.db
        .insert(links)
        .values({
          userId,
          sourceId: noteId,
          targetId: target?.id ?? null,
          targetTitle,
        })
        .returning();
      created.push(link);
    }
    return created;
  }

  async backlinks(userId: string, noteId: string) {
    return this.db
      .select({
        id: links.id,
        sourceId: links.sourceId,
        targetTitle: links.targetTitle,
        title: notes.title,
        updatedAt: notes.updatedAt,
      })
      .from(links)
      .innerJoin(notes, eq(notes.id, links.sourceId))
      .where(
        and(
          eq(links.userId, userId),
          eq(links.targetId, noteId),
          isNull(notes.deletedAt),
        ),
      );
  }

  async versions(userId: string, noteId: string) {
    await this.get(userId, noteId);
    return this.db
      .select()
      .from(noteVersions)
      .where(and(eq(noteVersions.noteId, noteId), eq(noteVersions.userId, userId)))
      .orderBy(desc(noteVersions.createdAt));
  }

  async restoreVersion(userId: string, noteId: string, versionId: string) {
    const [version] = await this.db
      .select()
      .from(noteVersions)
      .where(
        and(
          eq(noteVersions.id, versionId),
          eq(noteVersions.noteId, noteId),
          eq(noteVersions.userId, userId),
        ),
      )
      .limit(1);
    if (!version) throw new NotFoundException('Version not found');
    return this.update(
      userId,
      noteId,
      { title: version.title, body: version.body },
      { reason: 'restore' },
    );
  }

  async syncTags(userId: string, noteId: string, tagNames: string[]) {
    await this.db.delete(noteTags).where(eq(noteTags.noteId, noteId));
    const result = [];
    for (const name of tagNames) {
      const normalized = name.toLowerCase().replace(/^#/, '').trim();
      if (!normalized) continue;
      let [tag] = await this.db
        .select()
        .from(tags)
        .where(and(eq(tags.userId, userId), eq(tags.name, normalized)))
        .limit(1);
      if (!tag) {
        [tag] = await this.db
          .insert(tags)
          .values({ userId, name: normalized })
          .returning();
      }
      await this.db.insert(noteTags).values({ noteId, tagId: tag.id }).onConflictDoNothing();
      result.push(tag);
    }
    return result;
  }

  async listTags(userId: string) {
    return this.db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), isNull(tags.deletedAt)))
      .orderBy(tags.name);
  }

  async graph(userId: string) {
    const noteRows = await this.db
      .select({
        id: notes.id,
        title: notes.title,
        pinned: notes.pinned,
      })
      .from(notes)
      .where(and(eq(notes.userId, userId), isNull(notes.deletedAt), eq(notes.archived, false)));

    const linkRows = await this.db
      .select({
        sourceId: links.sourceId,
        targetId: links.targetId,
        targetTitle: links.targetTitle,
      })
      .from(links)
      .where(eq(links.userId, userId));

    return { nodes: noteRows, edges: linkRows };
  }
}
