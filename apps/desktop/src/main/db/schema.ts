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
      note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
      deleted_at INTEGER,
      phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      legal_person TEXT NOT NULL DEFAULT '', legal_person_phone TEXT NOT NULL DEFAULT '',
      uscc TEXT NOT NULL DEFAULT '', reg_address TEXT NOT NULL DEFAULT '',
      established_date TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS crm_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      wechat TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
      deleted_at INTEGER, sex TEXT NOT NULL DEFAULT ''
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
      amount_cents INTEGER NOT NULL DEFAULT 0, share_cents INTEGER NOT NULL DEFAULT 0,
      end_date TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS crm_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES crm_projects(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL, paid_at TEXT NOT NULL DEFAULT '',
      method TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT ''
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

  // CRM 增量列：CREATE TABLE IF NOT EXISTS 不会给已存在的老库加列，这里守护式补
  const GUARDED_COLUMNS: [table: string, column: string, ddl: string][] = [
    ['crm_clients', 'deleted_at', 'deleted_at INTEGER'],
    ['crm_contacts', 'deleted_at', 'deleted_at INTEGER'],
    ['crm_projects', 'deleted_at', 'deleted_at INTEGER'],
    ['crm_clients', 'phone', "phone TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'email', "email TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'legal_person', "legal_person TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'legal_person_phone', "legal_person_phone TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'uscc', "uscc TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'reg_address', "reg_address TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'established_date', "established_date TEXT NOT NULL DEFAULT ''"],
    ['crm_contacts', 'sex', "sex TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'source', "source TEXT NOT NULL DEFAULT ''"],
    ['crm_projects', 'share_cents', 'share_cents INTEGER NOT NULL DEFAULT 0'],
    ['crm_payments', 'method', "method TEXT NOT NULL DEFAULT ''"],
  ]
  for (const [table, column, ddl] of GUARDED_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
    }
  }
}
