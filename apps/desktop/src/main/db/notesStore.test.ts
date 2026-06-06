import Database from 'better-sqlite3-node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeNotesStore } from './notesStore'
import { migrate } from './schema'

let db: Database.Database
let store: ReturnType<typeof makeNotesStore>

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  store = makeNotesStore(db)
})
afterEach(() => db.close())

describe('notes folders', () => {
  it('creates, lists, renames, moves, deletes folders with nesting', () => {
    const a = store.folders.create(null, '工作')
    const b = store.folders.create(a, '周报')
    expect(store.folders.list()).toHaveLength(2)
    expect(store.folders.list().find((f) => f.id === b)?.parentId).toBe(a)

    store.folders.rename(b, '月报')
    expect(store.folders.list().find((f) => f.id === b)?.name).toBe('月报')

    store.folders.move(b, null)
    expect(store.folders.list().find((f) => f.id === b)?.parentId).toBeNull()

    store.folders.remove(a)
    expect(store.folders.list()).toHaveLength(1)
  })
})

describe('notes CRUD', () => {
  it('creates in root and in folder, updates title/content, moves', () => {
    const fid = store.folders.create(null, '工作')
    const n1 = store.notes.create(null)
    const n2 = store.notes.create(fid)
    expect(store.notes.list()).toHaveLength(2)
    expect(store.notes.list().find((n) => n.id === n2)?.folderId).toBe(fid)

    store.notes.update(n1, { title: '会议纪要', content: '# 会议纪要\n内容' })
    const got = store.notes.get(n1)
    expect(got?.title).toBe('会议纪要')
    expect(got?.content).toContain('内容')
    expect(got?.updatedAt).toBeGreaterThan(0)

    store.notes.move(n1, fid)
    expect(store.notes.get(n1)?.folderId).toBe(fid)

    store.notes.remove(n1)
    expect(store.notes.get(n1)).toBeNull()
  })
})

describe('files + cascade', () => {
  it('lists files by note; deleting folder cascades nested notes and file rows', () => {
    const top = store.folders.create(null, '顶层')
    const sub = store.folders.create(top, '子层')
    const n = store.notes.create(sub)
    store.files.add(n, { name: 'a.png', storedPath: `notes-files/${n}/a.png`, mime: 'image/png', size: 10 })
    expect(store.files.listByNote(n)).toHaveLength(1)

    store.folders.remove(top)
    expect(store.folders.list()).toHaveLength(0)
    expect(store.notes.get(n)).toBeNull()
    expect(store.files.listByNote(n)).toHaveLength(0)
  })

  it('collectDescendantNoteIds returns notes at any depth (three-level nesting)', () => {
    const top = store.folders.create(null, '顶层')
    const mid = store.folders.create(top, '中层')
    const leaf = store.folders.create(mid, '叶层')
    const n1 = store.notes.create(top)
    const n2 = store.notes.create(leaf)
    const outside = store.notes.create(null)
    const ids = store.folders.collectDescendantNoteIds(top)
    expect(ids.sort()).toEqual([n1, n2].sort())
    expect(ids).not.toContain(outside)
  })
})
