import type Database from 'better-sqlite3'

export interface NoteFolderRow {
  id: number
  parentId: number | null
  name: string
  createdAt: number
}

export interface NoteListItemRow {
  id: number
  folderId: number | null
  title: string
  updatedAt: number
}

export interface NoteRow {
  id: number
  folderId: number | null
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

export interface NoteFileRow {
  id: number
  noteId: number
  name: string
  storedPath: string
  mime: string
  size: number
  createdAt: number
}

function mapFolder(r: Record<string, unknown>): NoteFolderRow {
  return {
    id: r.id as number,
    parentId: (r.parent_id as number | null) ?? null,
    name: r.name as string,
    createdAt: r.created_at as number,
  }
}

function mapNoteListItem(r: Record<string, unknown>): NoteListItemRow {
  return {
    id: r.id as number,
    folderId: (r.folder_id as number | null) ?? null,
    title: r.title as string,
    updatedAt: r.updated_at as number,
  }
}

function mapNote(r: Record<string, unknown>): NoteRow {
  return {
    id: r.id as number,
    folderId: (r.folder_id as number | null) ?? null,
    title: r.title as string,
    content: r.content as string,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  }
}

function mapFile(r: Record<string, unknown>): NoteFileRow {
  return {
    id: r.id as number,
    noteId: r.note_id as number,
    name: r.name as string,
    storedPath: r.stored_path as string,
    mime: r.mime as string,
    size: r.size as number,
    createdAt: r.created_at as number,
  }
}

export function makeNotesStore(db: Database.Database) {
  return {
    folders: {
      list(): NoteFolderRow[] {
        const rows = db.prepare('SELECT * FROM notes_folders ORDER BY name').all() as Record<
          string,
          unknown
        >[]
        return rows.map(mapFolder)
      },
      create(parentId: number | null, name: string): number {
        const result = db
          .prepare('INSERT INTO notes_folders(parent_id, name, created_at) VALUES(?, ?, ?)')
          .run(parentId, name, Date.now())
        return result.lastInsertRowid as number
      },
      rename(id: number, name: string): void {
        db.prepare('UPDATE notes_folders SET name = ? WHERE id = ?').run(name, id)
      },
      move(id: number, parentId: number | null): void {
        db.prepare('UPDATE notes_folders SET parent_id = ? WHERE id = ?').run(parentId, id)
      },
      /** 删文件夹：子树笔记先脱挂（folder_id 置空）并丢进回收站，再删文件夹行——
       *  否则 notes.folder_id 的 ON DELETE CASCADE 会把笔记连带真删 */
      remove(id: number): void {
        db.transaction(() => {
          db.prepare(
            `WITH RECURSIVE sub(id) AS (
               SELECT ?
               UNION
               SELECT f.id FROM notes_folders f JOIN sub ON f.parent_id = sub.id
             )
             UPDATE notes SET folder_id = NULL, deleted_at = COALESCE(deleted_at, ?)
             WHERE folder_id IN (SELECT id FROM sub)`,
          ).run(id, Date.now())
          db.prepare('DELETE FROM notes_folders WHERE id = ?').run(id)
        })()
      },
      /** 该文件夹（含任意深度子文件夹）下所有笔记 id；删除前先收集，用于清理附件目录 */
      collectDescendantNoteIds(folderId: number): number[] {
        const rows = db
          .prepare(
            `WITH RECURSIVE sub(id) AS (
               SELECT ?
               UNION
               SELECT f.id FROM notes_folders f JOIN sub ON f.parent_id = sub.id
             )
             SELECT n.id FROM notes n WHERE n.folder_id IN (SELECT id FROM sub)`,
          )
          .all(folderId) as { id: number }[]
        return rows.map((r) => r.id)
      },
    },

    notes: {
      list(): NoteListItemRow[] {
        const rows = db
          .prepare(
            'SELECT id, folder_id, title, updated_at FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC',
          )
          .all() as Record<string, unknown>[]
        return rows.map(mapNoteListItem)
      },
      get(id: number): NoteRow | null {
        const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as
          | Record<string, unknown>
          | undefined
        return row ? mapNote(row) : null
      },
      create(folderId: number | null): number {
        const now = Date.now()
        const result = db
          .prepare(
            "INSERT INTO notes(folder_id, title, content, created_at, updated_at) VALUES(?, '', '', ?, ?)",
          )
          .run(folderId, now, now)
        return result.lastInsertRowid as number
      },
      update(id: number, n: { title: string; content: string }): void {
        db.prepare('UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(
          n.title,
          n.content,
          Date.now(),
          id,
        )
      },
      move(id: number, folderId: number | null): void {
        db.prepare('UPDATE notes SET folder_id = ? WHERE id = ?').run(folderId, id)
      },
      /** 软删：进回收站 */
      remove(id: number): void {
        db.prepare('UPDATE notes SET deleted_at = ? WHERE id = ?').run(Date.now(), id)
      },
      /** 标题/正文 LIKE 搜索；通配符转义 */
      search(query: string): NoteListItemRow[] {
        const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
        const rows = db
          .prepare(
            "SELECT id, folder_id, title, updated_at FROM notes WHERE deleted_at IS NULL AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\') ORDER BY updated_at DESC",
          )
          .all(like, like) as Record<string, unknown>[]
        return rows.map(mapNoteListItem)
      },
    },

    trash: {
      list(): NoteListItemRow[] {
        const rows = db
          .prepare(
            'SELECT id, folder_id, title, updated_at FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC',
          )
          .all() as Record<string, unknown>[]
        return rows.map(mapNoteListItem)
      },
      /** 恢复：原文件夹可能已删（删文件夹时已把笔记 folder_id 置空），原位或回根 */
      restore(id: number): void {
        db.prepare('UPDATE notes SET deleted_at = NULL WHERE id = ?').run(id)
      },
      removeForever(id: number): void {
        db.prepare('DELETE FROM notes WHERE id = ? AND deleted_at IS NOT NULL').run(id)
      },
      /** 清空回收站；返回被删笔记 id 供调用方清理附件目录 */
      empty(): number[] {
        const ids = (
          db.prepare('SELECT id FROM notes WHERE deleted_at IS NOT NULL').all() as { id: number }[]
        ).map((r) => r.id)
        db.prepare('DELETE FROM notes WHERE deleted_at IS NOT NULL').run()
        return ids
      },
    },

    files: {
      listByNote(noteId: number): NoteFileRow[] {
        const rows = db
          .prepare('SELECT * FROM notes_files WHERE note_id = ? ORDER BY created_at, id')
          .all(noteId) as Record<string, unknown>[]
        return rows.map(mapFile)
      },
      add(noteId: number, f: { name: string; storedPath: string; mime: string; size: number }): number {
        const result = db
          .prepare(
            'INSERT INTO notes_files(note_id, name, stored_path, mime, size, created_at) VALUES(?, ?, ?, ?, ?, ?)',
          )
          .run(noteId, f.name, f.storedPath, f.mime, f.size, Date.now())
        return result.lastInsertRowid as number
      },
      get(id: number): NoteFileRow | null {
        const row = db.prepare('SELECT * FROM notes_files WHERE id = ?').get(id) as
          | Record<string, unknown>
          | undefined
        return row ? mapFile(row) : null
      },
      remove(id: number): void {
        db.prepare('DELETE FROM notes_files WHERE id = ?').run(id)
      },
    },
  }
}
