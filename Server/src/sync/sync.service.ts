import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/db.module';
import {
  noteVersions,
  notes,
  reminders,
  syncMeta,
  tags,
  templates,
} from '../db/schema';

type SyncNote = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  archived: boolean;
  isDaily: boolean;
  dailyDate: string | null;
  encrypted: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version?: number;
};

type SyncTag = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version?: number;
};

type SyncTemplate = {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version?: number;
};

type SyncReminder = {
  id: string;
  noteId: string;
  remindAt: string;
  notificationId: string | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version?: number;
};

@Injectable()
export class SyncService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private async nextVersion(userId: string) {
    const [meta] = await this.db
      .insert(syncMeta)
      .values({ userId, currentVersion: 1 })
      .onConflictDoUpdate({
        target: syncMeta.userId,
        set: { currentVersion: sql`${syncMeta.currentVersion} + 1` },
      })
      .returning();
    return meta.currentVersion;
  }

  async push(
    userId: string,
    payload: {
      notes?: SyncNote[];
      tags?: SyncTag[];
      templates?: SyncTemplate[];
      reminders?: SyncReminder[];
    },
  ) {
    const conflicts: Array<{ id: string; type: string; reason: string }> = [];

    for (const incoming of payload.notes ?? []) {
      const version = await this.nextVersion(userId);
      const [existing] = await this.db
        .select()
        .from(notes)
        .where(and(eq(notes.id, incoming.id), eq(notes.userId, userId)))
        .limit(1);

      if (!existing) {
        await this.db.insert(notes).values({
          id: incoming.id,
          userId,
          title: incoming.title,
          body: incoming.body,
          pinned: incoming.pinned,
          archived: incoming.archived,
          isDaily: incoming.isDaily,
          dailyDate: incoming.dailyDate,
          encrypted: incoming.encrypted,
          createdAt: new Date(incoming.createdAt),
          updatedAt: new Date(incoming.updatedAt),
          deletedAt: incoming.deletedAt ? new Date(incoming.deletedAt) : null,
          version,
        });
      } else {
        const incomingUpdated = new Date(incoming.updatedAt).getTime();
        const existingUpdated = existing.updatedAt.getTime();
        if (incomingUpdated < existingUpdated) {
          conflicts.push({
            id: incoming.id,
            type: 'note',
            reason: 'server_newer',
          });
          continue;
        }
        if (incomingUpdated > existingUpdated) {
          await this.db.insert(noteVersions).values({
            noteId: existing.id,
            userId,
            title: existing.title,
            body: existing.body,
            reason: 'sync_conflict',
          });
        }
        await this.db
          .update(notes)
          .set({
            title: incoming.title,
            body: incoming.body,
            pinned: incoming.pinned,
            archived: incoming.archived,
            isDaily: incoming.isDaily,
            dailyDate: incoming.dailyDate,
            encrypted: incoming.encrypted,
            updatedAt: new Date(incoming.updatedAt),
            deletedAt: incoming.deletedAt ? new Date(incoming.deletedAt) : null,
            version,
          })
          .where(and(eq(notes.id, incoming.id), eq(notes.userId, userId)));
      }

      if (!incoming.encrypted && !incoming.deletedAt) {
        await this.db.execute(sql`
          UPDATE notes
          SET search_vector =
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(body, '')), 'B')
          WHERE id = ${incoming.id}
        `);
      }
    }

    for (const incoming of payload.tags ?? []) {
      const version = await this.nextVersion(userId);
      await this.db
        .insert(tags)
        .values({
          id: incoming.id,
          userId,
          name: incoming.name,
          color: incoming.color,
          createdAt: new Date(incoming.createdAt),
          updatedAt: new Date(incoming.updatedAt),
          deletedAt: incoming.deletedAt ? new Date(incoming.deletedAt) : null,
          version,
        })
        .onConflictDoUpdate({
          target: tags.id,
          set: {
            name: incoming.name,
            color: incoming.color,
            updatedAt: new Date(incoming.updatedAt),
            deletedAt: incoming.deletedAt ? new Date(incoming.deletedAt) : null,
            version,
          },
        });
    }

    for (const incoming of payload.templates ?? []) {
      const version = await this.nextVersion(userId);
      await this.db
        .insert(templates)
        .values({
          id: incoming.id,
          userId,
          name: incoming.name,
          body: incoming.body,
          createdAt: new Date(incoming.createdAt),
          updatedAt: new Date(incoming.updatedAt),
          deletedAt: incoming.deletedAt ? new Date(incoming.deletedAt) : null,
          version,
        })
        .onConflictDoUpdate({
          target: templates.id,
          set: {
            name: incoming.name,
            body: incoming.body,
            updatedAt: new Date(incoming.updatedAt),
            deletedAt: incoming.deletedAt ? new Date(incoming.deletedAt) : null,
            version,
          },
        });
    }

    for (const incoming of payload.reminders ?? []) {
      const version = await this.nextVersion(userId);
      await this.db
        .insert(reminders)
        .values({
          id: incoming.id,
          noteId: incoming.noteId,
          userId,
          remindAt: new Date(incoming.remindAt),
          notificationId: incoming.notificationId,
          done: incoming.done,
          createdAt: new Date(incoming.createdAt),
          updatedAt: new Date(incoming.updatedAt),
          deletedAt: incoming.deletedAt ? new Date(incoming.deletedAt) : null,
          version,
        })
        .onConflictDoUpdate({
          target: reminders.id,
          set: {
            remindAt: new Date(incoming.remindAt),
            notificationId: incoming.notificationId,
            done: incoming.done,
            updatedAt: new Date(incoming.updatedAt),
            deletedAt: incoming.deletedAt ? new Date(incoming.deletedAt) : null,
            version,
          },
        });
    }

    const [meta] = await this.db
      .select()
      .from(syncMeta)
      .where(eq(syncMeta.userId, userId))
      .limit(1);

    return {
      serverVersion: meta?.currentVersion ?? 0,
      conflicts,
    };
  }

  async pull(userId: string, since: number) {
    const noteRows = await this.db
      .select()
      .from(notes)
      .where(and(eq(notes.userId, userId), gt(notes.version, since)));
    const tagRows = await this.db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), gt(tags.version, since)));
    const templateRows = await this.db
      .select()
      .from(templates)
      .where(and(eq(templates.userId, userId), gt(templates.version, since)));
    const reminderRows = await this.db
      .select()
      .from(reminders)
      .where(and(eq(reminders.userId, userId), gt(reminders.version, since)));

    const [meta] = await this.db
      .select()
      .from(syncMeta)
      .where(eq(syncMeta.userId, userId))
      .limit(1);

    return {
      serverVersion: meta?.currentVersion ?? 0,
      notes: noteRows,
      tags: tagRows,
      templates: templateRows,
      reminders: reminderRows,
    };
  }
}
