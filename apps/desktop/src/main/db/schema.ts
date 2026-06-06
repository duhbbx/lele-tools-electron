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
    CREATE TABLE IF NOT EXISTS crm_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'company',
      note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS crm_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      wechat TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS crm_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      description TEXT NOT NULL DEFAULT '', server_addr TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL DEFAULT '', admin_url TEXT NOT NULL DEFAULT '',
      admin_user TEXT NOT NULL DEFAULT '', admin_pass TEXT NOT NULL DEFAULT '',
      wx_app_id TEXT NOT NULL DEFAULT '', wx_app_secret TEXT NOT NULL DEFAULT '',
      wx_pay_params TEXT NOT NULL DEFAULT '[]',
      amount_cents INTEGER NOT NULL DEFAULT 0, end_date TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS crm_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES crm_projects(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL, paid_at TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS crm_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES crm_projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL, stored_path TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0,
      uploaded_at INTEGER NOT NULL
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
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      name TEXT NOT NULL, stored_path TEXT NOT NULL,
      mime TEXT NOT NULL DEFAULT '', size INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `)
}
