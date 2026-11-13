import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  title: text('title').notNull().default(''),
  body: text('body').notNull().default(''),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  isDaily: integer('is_daily', { mode: 'boolean' }).notNull().default(false),
  dailyDate: text('daily_date'),
  encrypted: integer('encrypted', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
  version: integer('version').notNull().default(0),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366F1'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
  version: integer('version').notNull().default(0),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
});

export const noteTags = sqliteTable(
  'note_tags',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.tagId] })],
);

export const links = sqliteTable('links', {
  id: text('id').primaryKey(),
  sourceId: text('source_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  targetId: text('target_id'),
  targetTitle: text('target_title').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const noteVersions = sqliteTable('note_versions', {
  id: text('id').primaryKey(),
  noteId: text('note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default(''),
  body: text('body').notNull().default(''),
  reason: text('reason').notNull().default('edit'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  name: text('name').notNull(),
  body: text('body').notNull().default(''),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
  version: integer('version').notNull().default(0),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
});

export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  noteId: text('note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  remindAt: text('remind_at').notNull(),
  notificationId: text('notification_id'),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
  version: integer('version').notNull().default(0),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
});

export const syncState = sqliteTable('sync_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lastPulledVersion: integer('last_pulled_version').notNull().default(0),
  lastSyncedAt: text('last_synced_at'),
});

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type NoteVersion = typeof noteVersions.$inferSelect;
export type Link = typeof links.$inferSelect;
