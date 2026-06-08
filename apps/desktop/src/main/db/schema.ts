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
    CREATE TABLE IF NOT EXISTS notes_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES notes_folders(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER REFERENCES notes_folders(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS notes_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      name TEXT NOT NULL, stored_path TEXT NOT NULL,
      mime TEXT NOT NULL DEFAULT '', size INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    -- Issue 搬运：实例（搬运配置）/ 仓库（源+目标）/ issue 记录
    CREATE TABLE IF NOT EXISTS im_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS im_repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id INTEGER NOT NULL REFERENCES im_instances(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'source',
      owner TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      token TEXT NOT NULL DEFAULT '',
      last_pulled_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS im_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id INTEGER NOT NULL REFERENCES im_instances(id) ON DELETE CASCADE,
      repo_id INTEGER NOT NULL REFERENCES im_repos(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'source',
      number INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'open',
      html_url TEXT NOT NULL DEFAULT '',
      migrated INTEGER NOT NULL DEFAULT 0,
      source_issue_id INTEGER,
      ai_explain TEXT NOT NULL DEFAULT '',
      remote_created_at INTEGER NOT NULL DEFAULT 0,
      fetched_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(repo_id, number)
    );
  `)

  // 增量列：CREATE TABLE IF NOT EXISTS 不会给已存在的老库加列，这里守护式补
  const GUARDED_COLUMNS: [table: string, column: string, ddl: string][] = [
    ['notes', 'deleted_at', 'deleted_at INTEGER'],
    ['im_repos', 'last_pulled_at', 'last_pulled_at INTEGER NOT NULL DEFAULT 0'],
    ['im_issues', 'ai_explain', "ai_explain TEXT NOT NULL DEFAULT ''"],
  ]
  for (const [table, column, ddl] of GUARDED_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
    }
  }
}
