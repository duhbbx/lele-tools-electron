import type { ChatMessageRow } from '@lele/shared-types'
import { getDb } from './sqlite'

export const settingsStore = {
  get(key: string): string | null {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  },
  set(key: string, value: string): void {
    getDb()
      .prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  },
}

export const recentsStore = {
  list(limit = 8): string[] {
    const rows = getDb()
      .prepare('SELECT tool_id FROM recent_tools ORDER BY last_used DESC LIMIT ?')
      .all(limit) as { tool_id: string }[]
    return rows.map((r) => r.tool_id)
  },
  touch(toolId: string): void {
    getDb()
      .prepare(
        'INSERT INTO recent_tools(tool_id, last_used) VALUES(?, ?) ON CONFLICT(tool_id) DO UPDATE SET last_used = excluded.last_used',
      )
      .run(toolId, Date.now())
  },
}

export const chatsStore = {
  list(): ChatMessageRow[] {
    return getDb().prepare('SELECT id, role, content, ts FROM ai_chats ORDER BY id').all() as ChatMessageRow[]
  },
  append(role: 'user' | 'assistant', content: string): void {
    getDb().prepare('INSERT INTO ai_chats(role, content, ts) VALUES(?, ?, ?)').run(role, content, Date.now())
  },
  clear(): void {
    getDb().prepare('DELETE FROM ai_chats').run()
  },
}
