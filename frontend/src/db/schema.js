export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  all_day INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'personal',
  participants TEXT DEFAULT '[]',
  location TEXT DEFAULT '',
  recurrence TEXT DEFAULT 'none',
  reminders TEXT DEFAULT '[]',
  source TEXT DEFAULT 'voice',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export const INDEX_START_TIME_SQL = `
CREATE INDEX IF NOT EXISTS idx_schedules_start_time ON schedules(start_time);
`;

export const INDEX_CATEGORY_SQL = `
CREATE INDEX IF NOT EXISTS idx_schedules_category ON schedules(category);
`;
