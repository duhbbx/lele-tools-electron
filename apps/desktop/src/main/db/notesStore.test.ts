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

    // 删除 = 软删进回收站
    store.notes.remove(n1)
    expect(store.notes.list().map((n) => n.id)).not.toContain(n1)
    expect(store.trash.list().map((n) => n.id)).toContain(n1)
  })
})

describe('trash', () => {
  it('软删后 list/search 不可见，restore 原位恢复', () => {
    const fid = store.folders.create(null, '工作')
    const n = store.notes.create(fid)
    store.notes.update(n, { title: '会议纪要', content: '内容' })
    store.notes.remove(n)
    expect(store.notes.list()).toHaveLength(0)
    expect(store.notes.search('会议')).toHaveLength(0)
    store.trash.restore(n)
    expect(store.trash.list()).toHaveLength(0)
    expect(store.notes.list().find((x) => x.id === n)?.folderId).toBe(fid) // 原文件夹还在 → 原位
  })

  it('删文件夹：子树笔记脱挂进回收站而非真删，restore 回根目录', () => {
    const top = store.folders.create(null, '顶层')
    const sub = store.folders.create(top, '子层')
    const n = store.notes.create(sub)
    store.folders.remove(top)
    expect(store.folders.list()).toHaveLength(0)
    expect(store.trash.list().map((x) => x.id)).toContain(n)
    store.trash.restore(n)
    expect(store.notes.list().find((x) => x.id === n)?.folderId).toBeNull() // 文件夹没了 → 回根
  })

  it('removeForever 真删（含附件行级联），empty 清空并返回 id 列表', () => {
    const a = store.notes.create(null)
    const b = store.notes.create(null)
    store.files.add(a, { name: 'x.png', storedPath: `notes-files/${a}/x.png`, mime: 'image/png', size: 1 })
    store.notes.remove(a)
    store.notes.remove(b)
    store.trash.removeForever(a)
    expect(store.notes.get(a)).toBeNull()
    expect(store.files.listByNote(a)).toHaveLength(0)
    // removeForever 只动回收站里的行
    const c = store.notes.create(null)
    store.trash.removeForever(c)
    expect(store.notes.get(c)).not.toBeNull()
    expect(store.trash.empty().sort()).toEqual([b])
    expect(store.trash.list()).toHaveLength(0)
  })
})

describe('files + cascade', () => {
  it('lists files by note; deleting folder moves nested notes to trash, file rows survive', () => {
    const top = store.folders.create(null, '顶层')
    const sub = store.folders.create(top, '子层')
    const n = store.notes.create(sub)
    store.files.add(n, { name: 'a.png', storedPath: `notes-files/${n}/a.png`, mime: 'image/png', size: 10 })
    expect(store.files.listByNote(n)).toHaveLength(1)

    store.folders.remove(top)
    expect(store.folders.list()).toHaveLength(0)
    // 笔记进回收站（FK 级联不再误删），附件行保留到彻底删除
    expect(store.notes.list()).toHaveLength(0)
    expect(store.trash.list().map((x) => x.id)).toContain(n)
    expect(store.files.listByNote(n)).toHaveLength(1)
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

describe('notes search', () => {
  it('matches title and content, escapes LIKE wildcards', () => {
    const a = store.notes.create(null)
    store.notes.update(a, { title: '会议纪要', content: '# 会议纪要\n讨论了进度' })
    const b = store.notes.create(null)
    store.notes.update(b, { title: '购物清单', content: '牛奶 100% 纯的' })

    expect(store.notes.search('会议').map((n) => n.id)).toEqual([a])
    expect(store.notes.search('进度').map((n) => n.id)).toEqual([a])
    expect(store.notes.search('100%').map((n) => n.id)).toEqual([b])
    expect(store.notes.search('%').map((n) => n.id)).toEqual([b]) // 字面 % 只在 b
    expect(store.notes.search('不存在的词')).toHaveLength(0)
    expect(store.notes.search('100_').map((n) => n.id)).toHaveLength(0) // 字面 _ 不通配
  })
})
