import type Database from 'better-sqlite3'

export function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recent_tools (
      tool_id   TEXT PRIMARY KEY,
      last_used INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_chats (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      role    TEXT NOT NULL,
      content TEXT NOT NULL,
      ts      INTEGER NOT NULL
    );
  `)
}
