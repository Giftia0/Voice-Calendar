import * as SQLite from 'expo-sqlite';
import { CREATE_TABLE_SQL, INDEX_START_TIME_SQL, INDEX_CATEGORY_SQL } from './schema';

let db = null;

export async function getDatabase() {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('voice_calendar.db');

  await db.execAsync(CREATE_TABLE_SQL);
  await db.execAsync(INDEX_START_TIME_SQL);
  await db.execAsync(INDEX_CATEGORY_SQL);

  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
