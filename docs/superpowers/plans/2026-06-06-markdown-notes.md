# Markdown 记事本（notes 模块）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 lele-tools-electron 中新增「Markdown 记事本」工具：内部树状导航 + Monaco 编辑/marked 预览双栏（各自可开关）+ 图片/文件/多媒体附件，SQLite 持久化。

**Architecture:** 完全沿用 CRM 模块的分层：`schema.ts` 加表 → `notesStore.ts`（纯函数式 store，可内存库单测）→ `ipc/notes.ts`（IPC handler + `notes-file://` 自定义协议）→ preload 挂 `window.api.notes` → `packages/ui/src/tools/notes/` 渲染层组件。title 提取是纯函数放渲染层（保存时计算后传给主进程）。

**Tech Stack:** Electron 34 / Vue 3.5 / TypeScript / better-sqlite3 / Monaco Editor / marked / vitest

**设计文档:** `docs/superpowers/specs/2026-06-06-markdown-notes-design.md`

**约定提醒:**
- 提交信息不带 Co-Authored-By 署名（用户约定）。
- macOS 上如果需要重装依赖：`export PYTHON=python3.9` 再 `pnpm install`。
- 运行单测：`pnpm test`（根目录，vitest 扫 `packages/**/src/**/*.test.ts` 和 `apps/**/src/**/*.test.ts`，node 环境）。
- 单测里用 `better-sqlite3-node`（root devDependency，预编译的 Node ABI 版本），主进程代码用 `better-sqlite3`（Electron ABI）——照抄 `crmStore.test.ts` 的 import 方式。
- 全部 UI 文案走 `t()` i18n（zh/en 双语），样式用 CSS 变量（`--bg` / `--bg-soft` / `--bg-hover` / `--fg` / `--fg-dim` / `--border` / `--accent` / `--danger`），不引 UI 框架。

---

### Task 1: title 提取纯函数（TDD）

**Files:**
- Create: `packages/ui/src/tools/notes/title.ts`
- Test: `packages/ui/src/tools/notes/title.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `packages/ui/src/tools/notes/title.test.ts`：

```typescript
import { describe, expect, it } from 'vitest'
import { extractTitle } from './title'

describe('extractTitle', () => {
  it('取第一个一级标题', () => {
    expect(extractTitle('前言\n# 会议纪要\n内容')).toBe('会议纪要')
  })

  it('一级标题里的行内标记被剥掉', () => {
    expect(extractTitle('# **重点** `代码` 标题')).toBe('重点 代码 标题')
  })

  it('无一级标题时取第一行非空文本并剥掉 md 标记', () => {
    expect(extractTitle('\n\n- **重点**内容\n其他')).toBe('重点内容')
    expect(extractTitle('## 二级标题\n正文')).toBe('二级标题')
    expect(extractTitle('> 引用开头')).toBe('引用开头')
  })

  it('剥掉链接与图片标记保留文字', () => {
    expect(extractTitle('[链接文字](http://a.b) 后缀')).toBe('链接文字 后缀')
    expect(extractTitle('![图](notes-file://1/a.png) 说明')).toBe('图 说明')
  })

  it('全空返回空串', () => {
    expect(extractTitle('')).toBe('')
    expect(extractTitle('\n  \n')).toBe('')
  })

  it('截断到 20 个字符', () => {
    expect(extractTitle(`# ${'十'.repeat(30)}`)).toBe('十'.repeat(20))
    expect(extractTitle('# 刚好二十个字的标题不应该被截断哦正好')).toHaveLength(20)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/a9/Projects/lele-tools-electron && pnpm vitest run packages/ui/src/tools/notes/title.test.ts`
Expected: FAIL —— `Cannot find module './title'`（或同义报错）

- [ ] **Step 3: 写最小实现**

创建 `packages/ui/src/tools/notes/title.ts`：

```typescript
/** 从 Markdown 内容提取笔记标题：
 *  1. 第一个一级标题（`# xxx`）；
 *  2. 否则第一行非空文本（剥掉 Markdown 标记）；
 *  3. 全空返回 ''（UI 层显示「无标题」）。
 *  统一截断到 20 个字符。 */
const MAX_TITLE = 20

export function extractTitle(content: string): string {
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)$/)
    if (m) return truncate(cleanInline(m[1]))
  }
  for (const line of lines) {
    const text = cleanInline(line)
    if (text) return truncate(text)
  }
  return ''
}

function cleanInline(s: string): string {
  return s
    .replace(/^#{1,6}\s+/, '') // 标题井号
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, '') // 列表前缀
    .replace(/^>\s*/, '') // 引用
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // 图片 → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接 → 文字
    .replace(/[*_`~]/g, '') // 强调/代码标记
    .trim()
}

function truncate(s: string): string {
  return [...s].slice(0, MAX_TITLE).join('')
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run packages/ui/src/tools/notes/title.test.ts`
Expected: PASS（6 个用例全绿）

- [ ] **Step 5: 提交**

```bash
git add packages/ui/src/tools/notes/title.ts packages/ui/src/tools/notes/title.test.ts
git commit -m "feat(notes): title 提取纯函数"
```

---

### Task 2: DB schema + notesStore（TDD）

**Files:**
- Modify: `apps/desktop/src/main/db/schema.ts`（在 crm_files 表后追加三张表）
- Create: `apps/desktop/src/main/db/notesStore.ts`
- Test: `apps/desktop/src/main/db/notesStore.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/desktop/src/main/db/notesStore.test.ts`：

```typescript
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

  it('collectDescendantNoteIds returns notes in folder and all nested subfolders', () => {
    const top = store.folders.create(null, '顶层')
    const sub = store.folders.create(top, '子层')
    const n1 = store.notes.create(top)
    const n2 = store.notes.create(sub)
    const outside = store.notes.create(null)
    const ids = store.folders.collectDescendantNoteIds(top)
    expect(ids.sort()).toEqual([n1, n2].sort())
    expect(ids).not.toContain(outside)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run apps/desktop/src/main/db/notesStore.test.ts`
Expected: FAIL —— `Cannot find module './notesStore'`

- [ ] **Step 3: schema.ts 加表**

在 `apps/desktop/src/main/db/schema.ts` 的 `crm_files` 表定义之后（`` ` ``) 闭合前）追加：

```sql
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
```

注意：`parent_id` / `folder_id` 允许 NULL（NULL = 根级），所以不带 NOT NULL。`migrate()` 全是 `CREATE TABLE IF NOT EXISTS`，对已有用户库是纯增量，安全。

- [ ] **Step 4: 实现 notesStore.ts**

创建 `apps/desktop/src/main/db/notesStore.ts`（风格照抄 `crmStore.ts`：interface + map 函数 + `makeXxxStore(db)` 工厂）：

```typescript
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
      remove(id: number): void {
        db.prepare('DELETE FROM notes_folders WHERE id = ?').run(id)
      },
      /** 该文件夹（含任意深度子文件夹）下所有笔记 id；删除前先收集，用于清理附件目录 */
      collectDescendantNoteIds(folderId: number): number[] {
        const rows = db
          .prepare(
            `WITH RECURSIVE sub(id) AS (
               SELECT ?
               UNION ALL
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
          .prepare('SELECT id, folder_id, title, updated_at FROM notes ORDER BY updated_at DESC')
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
      remove(id: number): void {
        db.prepare('DELETE FROM notes WHERE id = ?').run(id)
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run apps/desktop/src/main/db/notesStore.test.ts`
Expected: PASS（4 个用例全绿）

- [ ] **Step 6: 跑全量测试防回归**

Run: `pnpm test`
Expected: 全部 PASS（含原有 crmStore 等测试）

- [ ] **Step 7: 提交**

```bash
git add apps/desktop/src/main/db/schema.ts apps/desktop/src/main/db/notesStore.ts apps/desktop/src/main/db/notesStore.test.ts
git commit -m "feat(notes): SQLite schema 与 notesStore"
```

---

### Task 3: shared-types 加 NotesBridge 契约

**Files:**
- Modify: `packages/shared-types/src/index.ts`（在 `CrmBridge` 之后、`WindowApi` 之前插入；并给 `WindowApi` 加 `notes` 字段）

- [ ] **Step 1: 加类型定义**

在 `packages/shared-types/src/index.ts` 的 `CrmBridge` 接口结束之后插入：

```typescript
export interface NoteFolder { id: number; parentId: number | null; name: string; createdAt: number }
export interface NoteListItem { id: number; folderId: number | null; title: string; updatedAt: number }
export interface Note { id: number; folderId: number | null; title: string; content: string; createdAt: number; updatedAt: number }
export interface NoteFile { id: number; noteId: number; name: string; storedPath: string; mime: string; size: number; createdAt: number }

export interface NotesBridge {
  folders: {
    list(): Promise<NoteFolder[]>
    create(parentId: number | null, name: string): Promise<number>
    rename(id: number, name: string): Promise<void>
    move(id: number, parentId: number | null): Promise<void>
    /** 级联删子文件夹与笔记，并清理这些笔记的附件目录 */
    remove(id: number): Promise<void>
  }
  /** 全量笔记列表（轻量字段，树渲染用） */
  list(): Promise<NoteListItem[]>
  get(id: number): Promise<Note | null>
  /** 新建空笔记，返回 id */
  create(folderId: number | null): Promise<number>
  /** title 由渲染层从 content 提取后传入 */
  update(id: number, content: string, title: string): Promise<void>
  move(id: number, folderId: number | null): Promise<void>
  /** 删笔记并清理 userData/notes-files/<id>/ */
  remove(id: number): Promise<void>
  files: {
    /** 弹系统文件选择框（kind=image 时只给图片过滤器）→ 拷贝到 userData/notes-files/<noteId>/ → 入库；取消返回 null */
    pick(noteId: number, kind: 'image' | 'file'): Promise<NoteFile | null>
    /** 剪贴板/拖拽来的二进制数据落盘入库 */
    paste(noteId: number, name: string, mime: string, data: Uint8Array): Promise<NoteFile>
    /** 按本地路径拷贝入库（拖拽文件用） */
    importPath(noteId: number, path: string): Promise<NoteFile | null>
    /** 系统默认程序打开附件 */
    open(id: number): Promise<void>
  }
  /** 拖拽的 File 对象 → 本地绝对路径（webUtils.getPathForFile，同步） */
  fileToPath(file: File): string
}
```

然后给 `WindowApi` 加一行：

```typescript
export interface WindowApi {
  ai: AiBridge
  store: StoreBridge
  recents: RecentsBridge
  chats: ChatsBridge
  menu: MenuBridge
  github: GithubBridge
  crm: CrmBridge
  notes: NotesBridge
}
```

- [ ] **Step 2: 类型检查（此时 preload 缺 notes 实现会报错，属预期，下个任务补上后再查）**

Run: `pnpm --filter @lele/shared-types exec tsc --noEmit -p tsconfig.json 2>/dev/null || pnpm -r --filter @lele/shared-types typecheck || true`

shared-types 包没有独立 typecheck 脚本的话跳过，本任务先不提交，与 Task 4、5 合并提交（保持每次提交可通过 typecheck）。

---

### Task 4: 主进程 ipc/notes.ts（IPC + notes-file 协议）+ 注册 + CSP

**Files:**
- Create: `apps/desktop/src/main/ipc/notes.ts`
- Modify: `apps/desktop/src/main/index.ts`（注册协议与 IPC）
- Modify: `apps/desktop/src/renderer/index.html`（CSP 放行 notes-file:）

- [ ] **Step 1: 实现 ipc/notes.ts**

创建 `apps/desktop/src/main/ipc/notes.ts`：

```typescript
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, dialog, ipcMain, net, protocol, shell } from 'electron'
import { makeNotesStore } from '../db/notesStore'
import { getDb } from '../db/sqlite'

let _store: ReturnType<typeof makeNotesStore> | null = null
function s(): ReturnType<typeof makeNotesStore> {
  if (_store === null) _store = makeNotesStore(getDb())
  return _store
}

function notesDir(): string {
  return join(app.getPath('userData'), 'notes-files')
}

function removeNoteDirs(noteIds: number[]): void {
  for (const id of noteIds) {
    rmSync(join(notesDir(), String(id)), { recursive: true, force: true })
  }
}

const EXT_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  pdf: 'application/pdf',
}

function mimeFor(name: string): string {
  return EXT_MIME[extname(name).slice(1).toLowerCase()] ?? ''
}

/** 把内容写进 userData/notes-files/<noteId>/，同名加时间戳前缀，入库并返回行 */
function storeFile(
  noteId: number,
  srcName: string,
  write: (dest: string) => void,
  mime: string,
) {
  const dir = join(notesDir(), String(noteId))
  mkdirSync(dir, { recursive: true })
  let destName = srcName
  if (existsSync(join(dir, destName))) destName = `${Date.now()}-${destName}`
  const dest = join(dir, destName)
  write(dest)
  const size = statSync(dest).size
  const storedPath = relative(app.getPath('userData'), dest)
  const id = s().files.add(noteId, { name: destName, storedPath, mime, size })
  return s().files.get(id)
}

/** 必须在 app ready 之前调用：让 notes-file:// 可被 <img>/<audio>/<video>/fetch 使用 */
export function registerNotesScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'notes-file', privileges: { secure: true, supportFetchAPI: true, stream: true } },
  ])
}

/** app ready 之后调用：notes-file://<fileId>/<name> → 附件目录里的真实文件 */
export function registerNotesProtocol(): void {
  protocol.handle('notes-file', (request) => {
    const id = Number(new URL(request.url).hostname)
    const row = Number.isInteger(id) ? s().files.get(id) : null
    if (!row) return new Response('not found', { status: 404 })
    const abs = resolve(app.getPath('userData'), row.storedPath)
    // 防路径穿越：必须落在附件目录内
    if (!abs.startsWith(notesDir() + sep)) return new Response('forbidden', { status: 403 })
    return net.fetch(pathToFileURL(abs).toString())
  })
}

export function registerNotesIpc(): void {
  // folders
  ipcMain.handle('notes:folders:list', () => s().folders.list())
  ipcMain.handle('notes:folders:create', (_e, parentId: number | null, name: string) =>
    s().folders.create(parentId, name),
  )
  ipcMain.handle('notes:folders:rename', (_e, id: number, name: string) =>
    s().folders.rename(id, name),
  )
  ipcMain.handle('notes:folders:move', (_e, id: number, parentId: number | null) =>
    s().folders.move(id, parentId),
  )
  ipcMain.handle('notes:folders:remove', (_e, id: number) => {
    const noteIds = s().folders.collectDescendantNoteIds(id)
    s().folders.remove(id)
    removeNoteDirs(noteIds)
  })

  // notes
  ipcMain.handle('notes:list', () => s().notes.list())
  ipcMain.handle('notes:get', (_e, id: number) => s().notes.get(id))
  ipcMain.handle('notes:create', (_e, folderId: number | null) => s().notes.create(folderId))
  ipcMain.handle('notes:update', (_e, id: number, content: string, title: string) =>
    s().notes.update(id, { title, content }),
  )
  ipcMain.handle('notes:move', (_e, id: number, folderId: number | null) =>
    s().notes.move(id, folderId),
  )
  ipcMain.handle('notes:remove', (_e, id: number) => {
    s().notes.remove(id)
    removeNoteDirs([id])
  })

  // files
  ipcMain.handle('notes:files:pick', async (_e, noteId: number, kind: 'image' | 'file') => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters:
        kind === 'image'
          ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }]
          : [],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const src = result.filePaths[0]
    return storeFile(noteId, basename(src), (dest) => copyFileSync(src, dest), mimeFor(src))
  })

  ipcMain.handle(
    'notes:files:paste',
    (_e, noteId: number, name: string, mime: string, data: Uint8Array) =>
      storeFile(noteId, name, (dest) => writeFileSync(dest, data), mime || mimeFor(name)),
  )

  ipcMain.handle('notes:files:importPath', (_e, noteId: number, path: string) => {
    if (!existsSync(path)) return null
    return storeFile(noteId, basename(path), (dest) => copyFileSync(path, dest), mimeFor(path))
  })

  ipcMain.handle('notes:files:open', async (_e, id: number) => {
    const row = s().files.get(id)
    if (!row) return
    await shell.openPath(join(app.getPath('userData'), row.storedPath))
  })
}
```

- [ ] **Step 2: 在 main/index.ts 注册**

修改 `apps/desktop/src/main/index.ts`：

import 区加：

```typescript
import { registerNotesIpc, registerNotesProtocol, registerNotesScheme } from './ipc/notes'
```

`const isDev = !app.isPackaged` 之后（模块顶层、app ready 之前）加：

```typescript
// 自定义协议特权声明必须在 app ready 前
registerNotesScheme()
```

`app.whenReady().then(() => {` 块里 `registerCrmIpc()` 之后加两行：

```typescript
  registerNotesIpc()
  registerNotesProtocol()
```

- [ ] **Step 3: CSP 放行 notes-file:**

修改 `apps/desktop/src/renderer/index.html` 的 CSP meta，`img-src` 加 `notes-file:`，并新增 `media-src`：

```html
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: notes-file:; media-src 'self' notes-file:"
    />
```

- [ ] **Step 4: 主进程类型检查**

Run: `pnpm --filter @lele/desktop typecheck:node`
Expected: PASS（无报错；此时 preload 还没写 notes，typecheck:web 暂时会因 WindowApi 缺字段报错，下个任务一起验证）

本任务与 Task 3、5 合并提交。

---

### Task 5: preload 挂 window.api.notes

**Files:**
- Modify: `apps/desktop/src/preload/index.ts`

- [ ] **Step 1: 实现 notes bridge**

`apps/desktop/src/preload/index.ts` 顶部 import 改为（加 `webUtils`）：

```typescript
import { contextBridge, ipcRenderer, webUtils } from 'electron'
```

`api` 对象的 `crm: {...}` 之后加：

```typescript
  notes: {
    folders: {
      list: () => ipcRenderer.invoke('notes:folders:list'),
      create: (parentId: number | null, name: string) =>
        ipcRenderer.invoke('notes:folders:create', parentId, name),
      rename: (id: number, name: string) => ipcRenderer.invoke('notes:folders:rename', id, name),
      move: (id: number, parentId: number | null) =>
        ipcRenderer.invoke('notes:folders:move', id, parentId),
      remove: (id: number) => ipcRenderer.invoke('notes:folders:remove', id),
    },
    list: () => ipcRenderer.invoke('notes:list'),
    get: (id: number) => ipcRenderer.invoke('notes:get', id),
    create: (folderId: number | null) => ipcRenderer.invoke('notes:create', folderId),
    update: (id: number, content: string, title: string) =>
      ipcRenderer.invoke('notes:update', id, content, title),
    move: (id: number, folderId: number | null) => ipcRenderer.invoke('notes:move', id, folderId),
    remove: (id: number) => ipcRenderer.invoke('notes:remove', id),
    files: {
      pick: (noteId: number, kind: 'image' | 'file') =>
        ipcRenderer.invoke('notes:files:pick', noteId, kind),
      paste: (noteId: number, name: string, mime: string, data: Uint8Array) =>
        ipcRenderer.invoke('notes:files:paste', noteId, name, mime, data),
      importPath: (noteId: number, path: string) =>
        ipcRenderer.invoke('notes:files:importPath', noteId, path),
      open: (id: number) => ipcRenderer.invoke('notes:files:open', id),
    },
    fileToPath: (file: File) => webUtils.getPathForFile(file),
  },
```

- [ ] **Step 2: 全仓类型检查**

Run: `pnpm typecheck`
Expected: PASS（shared-types / 主进程 / preload / ui 全过）

- [ ] **Step 3: 提交（Task 3+4+5 一起）**

```bash
git add packages/shared-types/src/index.ts apps/desktop/src/main/ipc/notes.ts apps/desktop/src/main/index.ts apps/desktop/src/renderer/index.html apps/desktop/src/preload/index.ts
git commit -m "feat(notes): 主进程 IPC、notes-file 协议与 preload 桥"
```

---

### Task 6: 工具注册（meta + i18n + 占位 Tool.vue）

**Files:**
- Create: `packages/ui/src/tools/notes/meta.ts`
- Create: `packages/ui/src/tools/notes/Tool.vue`（占位，后续任务替换）
- Modify: `packages/ui/src/tools/index.ts`
- Modify: `packages/ui/src/i18n.ts`

- [ ] **Step 1: meta.ts**

创建 `packages/ui/src/tools/notes/meta.ts`：

```typescript
import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'notes',
  name: { zh: '记事本', en: 'Notes' },
  desc: { zh: 'Markdown 笔记，树状管理，支持图片与附件', en: 'Markdown notes with tree navigation and attachments' },
  category: 'text',
  keywords: ['markdown', 'note', 'notes', '笔记', '记事本', 'jishiben', 'biji'],
  icon: '📝',
  load: () => import('./Tool.vue'),
}
```

- [ ] **Step 2: 占位 Tool.vue**

创建 `packages/ui/src/tools/notes/Tool.vue`：

```vue
<script setup lang="ts">
import { t } from '../../i18n'
</script>

<template>
  <div class="tool-page">
    <p>{{ t('notes.empty') }}</p>
  </div>
</template>
```

- [ ] **Step 3: 注册到 tools/index.ts**

修改 `packages/ui/src/tools/index.ts`：import 区按字母序加一行，TOOLS 数组加 `notesTool`：

```typescript
import { meta as notesTool } from './notes/meta'
```

```typescript
export const TOOLS: ToolMeta[] = [jsonFormatter, xmlFormatter, yamlFormatter, base64, baseConvert, charCounter, regexTest, textCrypto, passwordGen, uuidGen, qrCode, dateTime, cronTool, colorTools, httpStatus, issueMover, notesTool]
```

- [ ] **Step 4: i18n.ts 加文案**

在 `packages/ui/src/i18n.ts` 的 dict 里 `crm.confirmDelete` 之后追加：

```typescript
  'notes.tree': { zh: '笔记', en: 'Notes' },
  'notes.newFolder': { zh: '新建文件夹', en: 'New folder' },
  'notes.newNote': { zh: '新建笔记', en: 'New note' },
  'notes.untitled': { zh: '无标题', en: 'Untitled' },
  'notes.empty': { zh: '从左侧选择或新建一篇笔记', en: 'Select or create a note on the left' },
  'notes.insertImage': { zh: '插入图片', en: 'Insert image' },
  'notes.insertFile': { zh: '插入文件', en: 'Insert file' },
  'notes.editPane': { zh: '编辑', en: 'Edit' },
  'notes.previewPane': { zh: '预览', en: 'Preview' },
  'notes.saved': { zh: '已保存 ✓', en: 'Saved ✓' },
  'notes.saving': { zh: '保存中…', en: 'Saving…' },
  'notes.confirmDelete': { zh: '确认删除?', en: 'Confirm?' },
  'notes.rename': { zh: '重命名', en: 'Rename' },
```

- [ ] **Step 5: 类型检查 + 启动验证**

Run: `pnpm typecheck`
Expected: PASS

Run: `pnpm dev`（手动确认后 Ctrl+C）
Expected: 左侧「文本」分类下出现「📝 记事本」，点开显示占位文案。

- [ ] **Step 6: 提交**

```bash
git add packages/ui/src/tools/notes/meta.ts packages/ui/src/tools/notes/Tool.vue packages/ui/src/tools/index.ts packages/ui/src/i18n.ts
git commit -m "feat(notes): 注册记事本工具与 i18n 文案"
```

---

### Task 7: MonacoEditor 暴露 insertText

**Files:**
- Modify: `packages/ui/src/components/MonacoEditor.vue`

- [ ] **Step 1: 加 insertText 并 defineExpose**

在 `MonacoEditor.vue` 的 `onBeforeUnmount(() => editor?.dispose())` 之前加：

```typescript
/** 在光标处插入文本（无光标则插到开头）；供工具层做「插入图片/文件」 */
function insertText(text: string): void {
  if (!editor) return
  const sel = editor.getSelection() ?? new monaco.Selection(1, 1, 1, 1)
  editor.executeEdits('insert', [{ range: sel, text, forceMoveMarkers: true }])
  editor.focus()
}

defineExpose({ insertText })
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @lele/ui typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add packages/ui/src/components/MonacoEditor.vue
git commit -m "feat(ui): MonacoEditor 暴露 insertText"
```

---

### Task 8: NotesTree.vue 笔记导航树

**Files:**
- Create: `packages/ui/src/tools/notes/NotesTree.vue`

交互对齐 CrmTree：展开/折叠箭头、hover 显示操作按钮、内联表单、两步删除确认（3 秒超时）。新增：任意嵌套（扁平化渲染带 depth）、HTML5 拖拽移动、文件夹双击重命名。

- [ ] **Step 1: 实现组件**

创建 `packages/ui/src/tools/notes/NotesTree.vue`：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NoteFolder, NoteListItem } from '@lele/shared-types'
import { t } from '../../i18n'

const props = defineProps<{ selectedId: number | null }>()
const emit = defineEmits<{ select: [id: number]; removed: [id: number] }>()

// ── state ──────────────────────────────────────────────────────────────────
const folders = ref<NoteFolder[]>([])
const notes = ref<NoteListItem[]>([])
const expanded = ref(new Set<number>())

// 内联新建文件夹：false=没在加；number|null=在该文件夹（null=根）下加
const addingFolderIn = ref<number | null | false>(false)
const newFolderName = ref('')

// 重命名
const renamingId = ref<number | null>(null)
const renameText = ref('')

// 两步删除确认 key = `folder:${id}` | `note:${id}`
const pendingDelete = ref<string | null>(null)
const deleteTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ── data ───────────────────────────────────────────────────────────────────
async function refresh(): Promise<void> {
  try {
    folders.value = (await window.api?.notes?.folders?.list?.()) ?? []
    notes.value = (await window.api?.notes?.list?.()) ?? []
  } catch (e) {
    console.warn('[NotesTree] refresh error', e)
  }
}
void refresh()
defineExpose({ refresh })

// ── 扁平化渲染行 ─────────────────────────────────────────────────────────────
interface Row {
  kind: 'folder' | 'note'
  id: number
  depth: number
  label: string
  open?: boolean
}

const rows = computed<Row[]>(() => {
  const byParent = new Map<number | null, NoteFolder[]>()
  for (const f of folders.value) {
    const list = byParent.get(f.parentId) ?? []
    list.push(f)
    byParent.set(f.parentId, list)
  }
  const noteByFolder = new Map<number | null, NoteListItem[]>()
  for (const n of notes.value) {
    const list = noteByFolder.get(n.folderId) ?? []
    list.push(n)
    noteByFolder.set(n.folderId, list)
  }
  const out: Row[] = []
  const walk = (parentId: number | null, depth: number): void => {
    const fs = (byParent.get(parentId) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
    for (const f of fs) {
      const open = expanded.value.has(f.id)
      out.push({ kind: 'folder', id: f.id, depth, label: f.name, open })
      if (open) walk(f.id, depth + 1)
    }
    const ns = (noteByFolder.get(parentId) ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt)
    for (const n of ns) {
      out.push({ kind: 'note', id: n.id, depth, label: n.title })
    }
  }
  walk(null, 0)
  return out
})

function toggleExpand(id: number): void {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

// ── 新建 ─────────────────────────────────────────────────────────────────────
function startAddFolder(parentId: number | null): void {
  addingFolderIn.value = parentId
  newFolderName.value = ''
  if (parentId !== null) expanded.value = new Set(expanded.value).add(parentId)
}

async function confirmAddFolder(): Promise<void> {
  const name = newFolderName.value.trim()
  if (!name || addingFolderIn.value === false) return
  await window.api?.notes?.folders?.create?.(addingFolderIn.value, name)
  addingFolderIn.value = false
  await refresh()
}

async function addNote(folderId: number | null): Promise<void> {
  const id = await window.api?.notes?.create?.(folderId)
  if (folderId !== null) expanded.value = new Set(expanded.value).add(folderId)
  await refresh()
  if (id) emit('select', id)
}

// ── 重命名（双击文件夹） ──────────────────────────────────────────────────────
function startRename(f: Row): void {
  if (f.kind !== 'folder') return
  renamingId.value = f.id
  renameText.value = f.label
}

async function confirmRename(): Promise<void> {
  const name = renameText.value.trim()
  if (renamingId.value !== null && name) {
    await window.api?.notes?.folders?.rename?.(renamingId.value, name)
  }
  renamingId.value = null
  await refresh()
}

// ── 两步删除确认（CRM 同款） ──────────────────────────────────────────────────
function startDelete(key: string): void {
  if (pendingDelete.value && pendingDelete.value !== key) {
    clearTimer(pendingDelete.value)
    pendingDelete.value = null
  }
  if (pendingDelete.value === key) {
    void executeDelete(key)
    return
  }
  pendingDelete.value = key
  const timer = setTimeout(() => {
    if (pendingDelete.value === key) pendingDelete.value = null
    deleteTimers.delete(key)
  }, 3000)
  deleteTimers.set(key, timer)
}

function clearTimer(key: string): void {
  const timer = deleteTimers.get(key)
  if (timer !== undefined) {
    clearTimeout(timer)
    deleteTimers.delete(key)
  }
}

async function executeDelete(key: string): Promise<void> {
  clearTimer(key)
  pendingDelete.value = null
  const [kind, idStr] = key.split(':') as [string, string]
  const id = Number(idStr)
  try {
    if (kind === 'folder') {
      await window.api?.notes?.folders?.remove?.(id)
    } else {
      await window.api?.notes?.remove?.(id)
      emit('removed', id)
    }
    await refresh()
  } catch (e) {
    console.warn('[NotesTree] delete error', e)
  }
}

// ── 拖拽移动 ─────────────────────────────────────────────────────────────────
const dropTarget = ref<string | null>(null) // `folder:${id}` | 'root'

function onDragStart(e: DragEvent, row: Row): void {
  e.dataTransfer?.setData('application/x-lele-note', JSON.stringify({ kind: row.kind, id: row.id }))
}

function isDescendant(folderId: number, maybeAncestor: number): boolean {
  const parentOf = new Map(folders.value.map((f) => [f.id, f.parentId]))
  let cur: number | null = folderId
  while (cur !== null) {
    if (cur === maybeAncestor) return true
    cur = parentOf.get(cur) ?? null
  }
  return false
}

async function onDrop(e: DragEvent, targetFolderId: number | null): Promise<void> {
  dropTarget.value = null
  const raw = e.dataTransfer?.getData('application/x-lele-note')
  if (!raw) return
  e.stopPropagation()
  const { kind, id } = JSON.parse(raw) as { kind: 'folder' | 'note'; id: number }
  if (kind === 'note') {
    await window.api?.notes?.move?.(id, targetFolderId)
  } else {
    // 不能移到自己或自己的子树里
    if (targetFolderId !== null && (targetFolderId === id || isDescendant(targetFolderId, id))) return
    await window.api?.notes?.folders?.move?.(id, targetFolderId)
  }
  await refresh()
}
</script>

<template>
  <div
    class="notes-tree"
    :class="{ 'drop-root': dropTarget === 'root' }"
    @dragover.prevent="dropTarget = 'root'"
    @dragleave="dropTarget = null"
    @drop.prevent="onDrop($event, null)"
  >
    <div class="tree-header">
      <span class="tree-title">{{ t('notes.tree') }}</span>
      <button class="btn-icon" :title="t('notes.newFolder')" @click="startAddFolder(null)">📁+</button>
      <button class="btn-icon" :title="t('notes.newNote')" @click="addNote(null)">📄+</button>
    </div>

    <!-- 根级新建文件夹表单 -->
    <div v-if="addingFolderIn === null" class="inline-form">
      <input
        v-model="newFolderName"
        class="inline-input"
        :placeholder="t('notes.newFolder')"
        autofocus
        @keydown.enter="confirmAddFolder"
        @keydown.esc="addingFolderIn = false"
      />
      <button class="btn-icon" @click="confirmAddFolder">✓</button>
      <button class="btn-icon" @click="addingFolderIn = false">✕</button>
    </div>

    <template v-for="row in rows" :key="`${row.kind}:${row.id}`">
      <!-- 文件夹行 -->
      <div
        v-if="row.kind === 'folder'"
        class="tree-row"
        :class="{ 'drop-over': dropTarget === `folder:${row.id}` }"
        :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
        draggable="true"
        @click="toggleExpand(row.id)"
        @dblclick="startRename(row)"
        @dragstart="onDragStart($event, row)"
        @dragover.prevent.stop="dropTarget = `folder:${row.id}`"
        @dragleave.stop="dropTarget = null"
        @drop.prevent="onDrop($event, row.id)"
      >
        <span class="arrow">{{ row.open ? '▾' : '▸' }}</span>
        <span class="row-icon">📁</span>
        <template v-if="renamingId === row.id">
          <input
            v-model="renameText"
            class="inline-input"
            autofocus
            @click.stop
            @keydown.enter="confirmRename"
            @keydown.esc="renamingId = null"
            @blur="confirmRename"
          />
        </template>
        <span v-else class="row-label">{{ row.label }}</span>
        <button class="btn-icon small" :title="t('notes.newNote')" @click.stop="addNote(row.id)">📄+</button>
        <button class="btn-icon small" :title="t('notes.newFolder')" @click.stop="startAddFolder(row.id)">📁+</button>
        <button
          class="btn-del"
          :class="{ confirming: pendingDelete === `folder:${row.id}` }"
          @click.stop="startDelete(`folder:${row.id}`)"
        >{{ pendingDelete === `folder:${row.id}` ? t('notes.confirmDelete') : '×' }}</button>
      </div>

      <!-- 该文件夹下的内联新建文件夹表单 -->
      <div
        v-if="row.kind === 'folder' && addingFolderIn === row.id"
        class="inline-form"
        :style="{ paddingLeft: `${24 + row.depth * 14}px` }"
      >
        <input
          v-model="newFolderName"
          class="inline-input"
          :placeholder="t('notes.newFolder')"
          autofocus
          @keydown.enter="confirmAddFolder"
          @keydown.esc="addingFolderIn = false"
        />
        <button class="btn-icon" @click="confirmAddFolder">✓</button>
        <button class="btn-icon" @click="addingFolderIn = false">✕</button>
      </div>

      <!-- 笔记行 -->
      <div
        v-if="row.kind === 'note'"
        class="tree-row"
        :class="{ selected: props.selectedId === row.id }"
        :style="{ paddingLeft: `${24 + row.depth * 14}px` }"
        draggable="true"
        @click="emit('select', row.id)"
        @dragstart="onDragStart($event, row)"
      >
        <span class="row-icon">📄</span>
        <span class="row-label" :class="{ dim: !row.label }">{{ row.label || t('notes.untitled') }}</span>
        <button
          class="btn-del"
          :class="{ confirming: pendingDelete === `note:${row.id}` }"
          @click.stop="startDelete(`note:${row.id}`)"
        >{{ pendingDelete === `note:${row.id}` ? t('notes.confirmDelete') : '×' }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.notes-tree {
  overflow-y: auto;
  height: 100%;
  padding-bottom: 12px;
  border-right: 1px solid var(--border);

  &.drop-root { background: color-mix(in srgb, var(--accent) 6%, transparent); }

  .tree-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 10px 4px;

    .tree-title {
      flex: 1;
      font-size: 11px;
      color: var(--fg-dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }

  .inline-form {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
  }

  .inline-input {
    flex: 1;
    min-width: 60px;
    font-size: 12px;
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--bg);
    color: var(--fg);
    outline: none;
    &:focus { border-color: var(--accent); }
  }

  .tree-row {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px 4px 10px;
    cursor: pointer;
    user-select: none;

    &:hover {
      background: var(--bg-hover);
      .btn-del, .btn-icon.small { opacity: 1; }
    }

    &.selected { background: color-mix(in srgb, var(--accent) 16%, transparent); }
    &.drop-over { outline: 1px dashed var(--accent); outline-offset: -1px; }

    .arrow { font-size: 10px; color: var(--fg-dim); width: 13px; flex-shrink: 0; }
    .row-icon { font-size: 13px; width: 18px; flex-shrink: 0; text-align: center; }

    .row-label {
      flex: 1;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      &.dim { color: var(--fg-dim); }
    }
  }

  .btn-icon {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--fg-dim);
    font-size: 11px;
    padding: 1px 3px;
    border-radius: 3px;
    line-height: 1;
    flex-shrink: 0;

    &:hover { background: var(--bg-hover); color: var(--fg); }
    &.small { opacity: 0; }
  }

  .btn-del {
    opacity: 0;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--fg-dim);
    font-size: 13px;
    padding: 0 4px;
    border-radius: 3px;
    flex-shrink: 0;

    &:hover { color: var(--danger); }

    &.confirming {
      opacity: 1;
      color: var(--danger);
      font-size: 11px;
      background: color-mix(in srgb, var(--danger) 12%, transparent);
      padding: 1px 5px;
    }
  }
}
</style>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @lele/ui typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add packages/ui/src/tools/notes/NotesTree.vue
git commit -m "feat(notes): 笔记导航树组件（嵌套/拖拽/两步删除）"
```

---

### Task 9: NotePreview.vue 预览栏

**Files:**
- Create: `packages/ui/src/tools/notes/NotePreview.vue`

- [ ] **Step 1: 实现组件**

创建 `packages/ui/src/tools/notes/NotePreview.vue`：

```vue
<script setup lang="ts">
import { Marked } from 'marked'
import { computed } from 'vue'

const props = defineProps<{ content: string }>()

const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'ogg', 'flac']
const VIDEO_EXT = ['mp4', 'webm', 'mov']

// 独立 Marked 实例避免污染全局（AiChatPanel 用的是全局 marked）；
// image 渲染按扩展名升级为 <audio>/<video>
const md = new Marked({
  renderer: {
    image({ href, text }): string {
      const ext = (href.split('.').pop() ?? '').toLowerCase()
      if (AUDIO_EXT.includes(ext)) return `<audio controls src="${href}"></audio>`
      if (VIDEO_EXT.includes(ext)) return `<video controls src="${href}"></video>`
      return `<img src="${href}" alt="${text}">`
    },
  },
})

const html = computed(() => md.parse(props.content, { async: false }) as string)

function onClick(e: MouseEvent): void {
  const a = (e.target as HTMLElement).closest('a')
  if (!a) return
  e.preventDefault()
  const href = a.getAttribute('href') ?? ''
  if (href.startsWith('notes-file://')) {
    const id = Number(new URL(href).hostname)
    if (id) void window.api?.notes?.files?.open?.(id)
  } else if (/^https?:/.test(href)) {
    // 经主进程 setWindowOpenHandler 转交系统浏览器
    window.open(href)
  }
}
</script>

<template>
  <div class="note-preview" @click="onClick" v-html="html" />
</template>

<style scoped lang="scss">
.note-preview {
  overflow-y: auto;
  height: 100%;
  padding: 12px 18px;
  font-size: 14px;
  line-height: 1.7;

  :deep(h1) { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.25em; }
  :deep(h2) { font-size: 1.25em; }
  :deep(h1), :deep(h2), :deep(h3) { margin: 0.8em 0 0.4em; }
  :deep(p) { margin: 0.4em 0; }
  :deep(img), :deep(video) { max-width: 100%; border-radius: 6px; }
  :deep(audio) { width: 100%; }
  :deep(a) { color: var(--accent); }
  :deep(code) {
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 0.9em;
  }
  :deep(pre) {
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 12px;
    overflow-x: auto;
    code { background: none; border: none; padding: 0; }
  }
  :deep(blockquote) {
    margin: 0.6em 0;
    padding: 2px 12px;
    border-left: 3px solid var(--accent);
    color: var(--fg-dim);
  }
  :deep(table) { border-collapse: collapse; }
  :deep(th), :deep(td) { border: 1px solid var(--border); padding: 4px 10px; }
}
</style>
```

注意：marked v18 的对象式 renderer 里 `image` 收到的是 token 对象 `{ href, title, text }`，解构 `{ href, text }` 即可。若 typecheck 报参数类型不匹配，签名写成 `image(token: { href: string; title: string | null; text: string }): string` 并解构 token。

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @lele/ui typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add packages/ui/src/tools/notes/NotePreview.vue
git commit -m "feat(notes): Markdown 预览组件（多媒体渲染/附件打开）"
```

---

### Task 10: NoteEditor.vue 编辑栏（粘贴/拖拽附件）

**Files:**
- Create: `packages/ui/src/tools/notes/NoteEditor.vue`

- [ ] **Step 1: 实现组件**

创建 `packages/ui/src/tools/notes/NoteEditor.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { NoteFile } from '@lele/shared-types'
import MonacoEditor from '../../components/MonacoEditor.vue'

const props = defineProps<{ modelValue: string; noteId: number }>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

const editorRef = ref<InstanceType<typeof MonacoEditor>>()

function insertText(text: string): void {
  editorRef.value?.insertText(text)
}

/** 按附件 mime 生成 Markdown：图片/音频/视频用 ![]() 让预览渲染媒体，其他用普通链接 */
function insertFileMd(row: NoteFile): void {
  const url = `notes-file://${row.id}/${encodeURIComponent(row.name)}`
  const isMedia = /^(image|audio|video)\//.test(row.mime)
  insertText(isMedia ? `![${row.name}](${url})\n` : `[${row.name}](${url})\n`)
}

defineExpose({ insertText, insertFileMd })

/** 粘贴剪贴板里的文件/截图（capture 阶段先于 Monaco 处理） */
async function onPaste(e: ClipboardEvent): Promise<void> {
  const items = Array.from(e.clipboardData?.items ?? [])
  const fileItem = items.find((i) => i.kind === 'file')
  if (!fileItem) return // 纯文本粘贴交给 Monaco
  const f = fileItem.getAsFile()
  if (!f) return
  e.preventDefault()
  e.stopPropagation()
  const data = new Uint8Array(await f.arrayBuffer())
  // 截图粘贴的文件名通常是 image.png，换成时间戳避免同名堆积
  const name = !f.name || f.name === 'image.png' ? `paste-${Date.now()}.png` : f.name
  const row = await window.api?.notes?.files?.paste?.(props.noteId, name, f.type, data)
  if (row) insertFileMd(row)
}

/** 拖拽本地文件进编辑器 */
async function onDrop(e: DragEvent): Promise<void> {
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length === 0) return
  e.preventDefault()
  e.stopPropagation()
  for (const f of files) {
    const path = window.api?.notes?.fileToPath?.(f) ?? ''
    if (!path) continue
    const row = await window.api?.notes?.files?.importPath?.(props.noteId, path)
    if (row) insertFileMd(row)
  }
}
</script>

<template>
  <div class="note-editor" @paste.capture="onPaste" @drop.capture="onDrop" @dragover.prevent>
    <MonacoEditor
      ref="editorRef"
      :model-value="modelValue"
      language="markdown"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped>
.note-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.note-editor :deep(.monaco-host) {
  flex: 1;
  border: none;
  border-radius: 0;
}
</style>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @lele/ui typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add packages/ui/src/tools/notes/NoteEditor.vue
git commit -m "feat(notes): 编辑组件（粘贴截图/拖拽文件入库）"
```

---

### Task 11: Tool.vue 总装（布局/栏开关/自动保存）

**Files:**
- Modify: `packages/ui/src/tools/notes/Tool.vue`（替换 Task 6 的占位实现）

- [ ] **Step 1: 实现完整 Tool.vue**

用以下内容整体替换 `packages/ui/src/tools/notes/Tool.vue`：

```vue
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { Note } from '@lele/shared-types'
import { t } from '../../i18n'
import NoteEditor from './NoteEditor.vue'
import NotePreview from './NotePreview.vue'
import NotesTree from './NotesTree.vue'
import { extractTitle } from './title'

const treeRef = ref<InstanceType<typeof NotesTree>>()
const editorRef = ref<InstanceType<typeof NoteEditor>>()

// 三栏开关：编辑/预览不允许同时关
const showTree = ref(true)
const showEdit = ref(true)
const showPreview = ref(true)

const note = ref<Note | null>(null)
const content = ref('')
const saveState = ref<'idle' | 'saving' | 'saved'>('idle')

let saveTimer: ReturnType<typeof setTimeout> | null = null
let dirty = false
let loading = false // 加载笔记时抑制 content watcher

function togglePane(pane: 'edit' | 'preview'): void {
  if (pane === 'edit') {
    if (showEdit.value && !showPreview.value) return
    showEdit.value = !showEdit.value
  } else {
    if (showPreview.value && !showEdit.value) return
    showPreview.value = !showPreview.value
  }
}

async function flush(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!dirty || !note.value) return
  dirty = false
  const title = extractTitle(content.value)
  await window.api?.notes?.update?.(note.value.id, content.value, title)
  saveState.value = 'saved'
  if (note.value && title !== note.value.title) {
    note.value.title = title
    void treeRef.value?.refresh()
  }
}

watch(content, () => {
  if (loading || !note.value) return
  dirty = true
  saveState.value = 'saving'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void flush(), 800)
})

async function openNote(id: number): Promise<void> {
  await flush()
  const n = await window.api?.notes?.get?.(id)
  if (!n) return
  loading = true
  note.value = n
  content.value = n.content
  dirty = false
  saveState.value = 'idle'
  // watch 是同步触发的，下一拍解除抑制
  requestAnimationFrame(() => {
    loading = false
  })
}

function onRemoved(id: number): void {
  if (note.value?.id === id) {
    note.value = null
    content.value = ''
    dirty = false
    saveState.value = 'idle'
  }
}

async function insertAttachment(kind: 'image' | 'file'): Promise<void> {
  if (!note.value) return
  const row = await window.api?.notes?.files?.pick?.(note.value.id, kind)
  if (row) editorRef.value?.insertFileMd(row)
}

onBeforeUnmount(() => void flush())
</script>

<template>
  <div class="tool-page notes-tool">
    <div class="row">
      <button class="btn" :class="{ primary: showTree }" :title="t('notes.tree')" @click="showTree = !showTree">🗂</button>
      <button class="btn" :disabled="!note || !showEdit" @click="insertAttachment('image')">{{ t('notes.insertImage') }}</button>
      <button class="btn" :disabled="!note || !showEdit" @click="insertAttachment('file')">{{ t('notes.insertFile') }}</button>
      <span class="grow" />
      <span class="save-state">{{ saveState === 'saving' ? t('notes.saving') : saveState === 'saved' ? t('notes.saved') : '' }}</span>
      <button class="btn" :class="{ primary: showEdit }" @click="togglePane('edit')">{{ t('notes.editPane') }}</button>
      <button class="btn" :class="{ primary: showPreview }" @click="togglePane('preview')">{{ t('notes.previewPane') }}</button>
    </div>

    <div class="panes">
      <NotesTree
        v-show="showTree"
        ref="treeRef"
        class="tree"
        :selected-id="note?.id ?? null"
        @select="openNote"
        @removed="onRemoved"
      />
      <template v-if="note">
        <NoteEditor
          v-show="showEdit"
          ref="editorRef"
          v-model="content"
          :note-id="note.id"
          class="pane"
        />
        <NotePreview v-show="showPreview" :content="content" class="pane preview" />
      </template>
      <div v-else class="empty">{{ t('notes.empty') }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.notes-tool {
  .save-state {
    font-size: 12px;
    color: var(--fg-dim);
    min-width: 64px;
    text-align: right;
  }

  .panes {
    flex: 1;
    display: flex;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-soft);

    .tree { width: 220px; flex-shrink: 0; }

    .pane {
      flex: 1;
      min-width: 0;
      &.preview { border-left: 1px solid var(--border); }
    }

    .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--fg-dim);
      font-size: 13px;
    }
  }
}
</style>
```

- [ ] **Step 2: 类型检查 + 全量测试**

Run: `pnpm typecheck && pnpm test`
Expected: 全 PASS

- [ ] **Step 3: 提交**

```bash
git add packages/ui/src/tools/notes/Tool.vue
git commit -m "feat(notes): 记事本主界面（三栏布局/栏开关/自动保存）"
```

---

### Task 12: 手动端到端验证

**Files:** 无新文件，运行验证。

- [ ] **Step 1: 启动应用**

Run: `pnpm dev`

- [ ] **Step 2: 按清单逐项验证**

1. 左侧「文本」分类出现「📝 记事本」，点开进入标签页，内部出现笔记树 + 空态提示。
2. 树头部 📁+ 新建文件夹「工作」，在其行上 📁+ 再建子文件夹「周报」（嵌套）。
3. 📄+ 新建笔记，自动选中，编辑器输入 `# 第一篇测试笔记`，停顿 1 秒 → 状态显示「已保存 ✓」，树上标题变为「第一篇测试笔记」。
4. 输入超过 20 字的一级标题 → 树上截断为 20 字；删光内容 → 显示「无标题」。
5. 预览栏实时渲染 Markdown（标题/列表/代码块样式正常，明暗主题切换跟随）。
6. 「编辑」「预览」按钮分别可关；两个都试图关掉时最后一栏不动；🗂 可折叠树。
7. 「插入图片」选一张 png → 编辑器插入 `![...](notes-file://...)`，预览显示图片。
8. 截图后在编辑器 Cmd+V → 自动落盘并插入，预览显示。
9. 拖一个 pdf 进编辑器 → 插入普通链接，预览里点击 → 系统默认程序打开。
10. 拖一个 mp4/mp3 进编辑器 → 预览渲染成播放器可播放。
11. 拖拽笔记到文件夹、文件夹到根，树结构正确更新；文件夹拖进自己子树被拒绝（无变化）。
12. 删除笔记（两步确认）→ `~/Library/Application Support/lele-desktop*/notes-files/<id>/` 目录被清理（`ls` 确认；userData 目录名以实际为准，可在 dev 控制台 `require('electron').app.getPath('userData')` 或直接 `ls ~/Library/Application\ Support/ | grep -i lele` 找）。
13. 删除含笔记的文件夹 → 级联删除，附件目录同步清理。
14. 重启应用 → 树结构与笔记内容仍在（持久化生效）。

- [ ] **Step 3: 发现问题则修复**

任何一项不过：用 superpowers:systematic-debugging 流程定位修复，修复后重跑该项，并把要点追加到 `docs/踩坑与要点.md`（全局约定）。

- [ ] **Step 4: 提交（如有修复）**

```bash
git add -A
git commit -m "fix(notes): 端到端验证修复"
```

---

### Task 13: 补 CLAUDE.md

**Files:**
- Create: `/Users/a9/Projects/lele-tools-electron/CLAUDE.md`

- [ ] **Step 1: 写 CLAUDE.md**

```markdown
# lele-tools-electron

乐乐的工具箱（Electron 版）。Qt 版 lele-tools 的重写：15+ 开发者工具 + CRM + AI 助手 + Markdown 记事本。

## 技术栈与结构

Electron 34 / Vue 3.5 / Vite 6（electron-vite）/ TypeScript / SCSS / Monaco Editor / better-sqlite3 / marked。pnpm monorepo：

- `apps/desktop` — Electron 壳：`src/main`（主进程：ipc/、db/）、`src/preload`、`src/renderer`（只是挂载 @lele/ui 的 Workspace）
- `packages/ui` — 全部界面与工具实现（Vue 组件库）
- `packages/shared-types` — 渲染层 ↔ 主进程 IPC 契约（WindowApi）
- `apps/website` — 官网

## 常用命令

```bash
export PYTHON=python3.9   # macOS 首次 pnpm install 编译原生模块必须（默认 python3.14 没有 distutils）
pnpm install
pnpm dev          # 起桌面应用（electron-vite dev）
pnpm typecheck    # 全仓类型检查（node + web）
pnpm test         # vitest 全量单测
pnpm lint         # biome
pnpm dist         # 打包
```

## 模式约定（新增功能照这些套路走）

- **新增工具**：`packages/ui/src/tools/<id>/` 下建 `meta.ts`（ToolMeta）+ `Tool.vue`，在 `tools/index.ts` 注册即可；侧边栏/搜索/标签页自动生效。纯逻辑抽成 `.ts` 纯函数 + 同目录 `.test.ts`。
- **需要主进程能力的模块**（DB/文件/网络）：参考 CRM 与 notes 模块四件套——
  1. `apps/desktop/src/main/db/schema.ts` 加表（全部 `CREATE TABLE IF NOT EXISTS`，增量安全）；
  2. `db/<x>Store.ts` 写 `make<X>Store(db)` 工厂（可用 `better-sqlite3-node` 内存库单测）；
  3. `main/ipc/<x>.ts` 写 `register<X>Ipc()`，频道命名 `模块:实体:操作`，在 `main/index.ts` 注册；
  4. `shared-types` 加 Bridge 接口 → `preload/index.ts` 实现挂到 `window.api.<x>`。
- **单测**：vitest，node 环境；主进程 store 测试 import `better-sqlite3-node`（Node ABI），业务代码 import `better-sqlite3`（Electron ABI），不要混。
- **附件存储**：拷到 `userData/<模块>-files/<ownerId>/`，DB 记 userData 相对路径，删除时同步清理目录。渲染层读本地附件走自定义协议（见 `ipc/notes.ts` 的 `notes-file://`），新协议要 `registerSchemesAsPrivileged`（app ready 前）+ 更新 renderer/index.html 的 CSP。
- **i18n**：壳层文案进 `packages/ui/src/i18n.ts` 的 dict（zh/en 都要）；工具名/描述放 meta.ts。
- **样式**：无 UI 框架，用 styles.scss 的 CSS 变量（--bg/--bg-soft/--bg-hover/--fg/--fg-dim/--border/--accent/--danger）适配明暗双主题；图标用 emoji。
- **git 提交**：信息用中文、约定式前缀（feat/fix/docs/...），不带 Co-Authored-By。

## 文档

- 设计文档：`docs/superpowers/specs/`，实现计划：`docs/superpowers/plans/`
- 踩坑速查：`docs/踩坑与要点.md`（解决问题后追加要点，全局约定）
```

- [ ] **Step 2: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: 补 CLAUDE.md 项目约定"
```

---

## 自查记录（写计划时已核对）

- **Spec 覆盖**：三栏布局/栏开关 → Task 11；树嵌套/拖拽/两步删除 → Task 8；title 规则 → Task 1；自动保存 800ms → Task 11；附件三种插入方式 → Task 10+11；notes-file 协议+防穿越 → Task 4；级联清理 → Task 2+4；IPC 命名 → Task 4；单测 → Task 1+2；CLAUDE.md → Task 13。
- **类型一致性**：`NotesBridge`（Task 3）↔ preload（Task 5）↔ IPC handler 签名（Task 4）↔ store（Task 2）已逐一对齐；组件间 `NoteFile`/`Note`/`NoteListItem`/`NoteFolder` 统一从 `@lele/shared-types` 导入。
- **风险点**：marked v18 renderer token 签名（Task 9 已写备用方案）；Monaco 对 paste/drop 事件的拦截顺序（capture 阶段处理，Task 10）；`requestAnimationFrame` 解除 loading 抑制（Task 11，若 watch 时序仍有问题改用 `nextTick`）。
