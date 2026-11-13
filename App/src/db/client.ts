import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const expoDb = openDatabaseSync('noti.db', { enableChangeListener: true });

export const db = drizzle(expoDb, { schema });
export const rawDb = expoDb;

export function ensureFts() {
  expoDb.execSync(`
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      title,
      body,
      content='notes',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, body)
      SELECT new.rowid, new.title, new.body
      WHERE new.deleted_at IS NULL AND new.encrypted = 0;
    END;

    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, body)
      VALUES('delete', old.rowid, old.title, old.body);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, body)
      VALUES('delete', old.rowid, old.title, old.body);
      INSERT INTO notes_fts(rowid, title, body)
      SELECT new.rowid, new.title, new.body
      WHERE new.deleted_at IS NULL AND new.encrypted = 0;
    END;
  `);
}
