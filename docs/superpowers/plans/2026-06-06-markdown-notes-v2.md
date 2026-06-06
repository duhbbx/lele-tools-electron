# Markdown 记事本 v2（搜索/滚动联动/PDF 导出）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给已交付的 notes 模块加三个增强：树内搜索（标题+全文）、编辑⇄预览双向滚动联动、PDF 导出（可选文字水印）。

**Architecture:** 搜索沿用四层套路（store→IPC→preload→UI）；滚动联动是纯渲染层（三组件 + Tool.vue 协调）；PDF 导出由渲染层送 HTML、主进程隐藏窗口 printToPDF。

**Tech Stack:** 同 v1。设计文档：`docs/superpowers/specs/2026-06-06-markdown-notes-v2-design.md`

**约定提醒:** 提交不带 Co-Authored-By；测试用 `better-sqlite3-node`；样式用 CSS 变量；i18n zh/en 双语。

---

### Task 1: notes.search（TDD，store→IPC→preload→types 一次提交）

**Files:**
- Modify: `apps/desktop/src/main/db/notesStore.ts`（notes 组加 search）
- Test: `apps/desktop/src/main/db/notesStore.test.ts`（追加 describe）
- Modify: `apps/desktop/src/main/ipc/notes.ts`、`apps/desktop/src/preload/index.ts`、`packages/shared-types/src/index.ts`

- [ ] **Step 1: 追加失败测试**

`notesStore.test.ts` 追加：

```typescript
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
  })
})
```

- [ ] **Step 2: 跑测试确认失败**（`pnpm vitest run apps/desktop/src/main/db/notesStore.test.ts`）

- [ ] **Step 3: store 实现** —— notesStore.ts 的 `notes` 组、`list()` 之后加：

```typescript
      /** 标题/正文 LIKE 搜索；通配符转义 */
      search(query: string): NoteListItemRow[] {
        const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
        const rows = db
          .prepare(
            "SELECT id, folder_id, title, updated_at FROM notes WHERE title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\' ORDER BY updated_at DESC",
          )
          .all(like, like) as Record<string, unknown>[]
        return rows.map(mapNoteListItem)
      },
```

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: IPC + preload + 类型**

ipc/notes.ts notes 区加：`ipcMain.handle('notes:search', (_e, query: string) => s().notes.search(query))`
shared-types NotesBridge 的 `list()` 后加：`/** 标题+全文 LIKE 搜索 */\n  search(query: string): Promise<NoteListItem[]>`
preload notes 的 `list` 后加：`search: (query: string) => ipcRenderer.invoke('notes:search', query),`

- [ ] **Step 6: `pnpm typecheck && pnpm test` 全过，提交**

```bash
git add -u apps/desktop packages/shared-types
git commit -m "feat(notes): 标题+全文搜索（store/IPC/preload）"
```

---

### Task 2: NotesTree 搜索 UI

**Files:**
- Modify: `packages/ui/src/tools/notes/NotesTree.vue`
- Modify: `packages/ui/src/i18n.ts`（加 `'notes.search': { zh: '搜索笔记…', en: 'Search notes…' }`）

- [ ] **Step 1: script 加搜索状态**（state 区之后）：

```typescript
// ── 搜索 ─────────────────────────────────────────────────────────────────────
const searchText = ref('')
const searchResults = ref<NoteListItem[] | null>(null) // null = 未在搜索
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(searchText, () => {
  if (searchTimer) clearTimeout(searchTimer)
  const q = searchText.value.trim()
  if (!q) {
    searchResults.value = null
    return
  }
  searchTimer = setTimeout(async () => {
    try {
      searchResults.value = (await window.api?.notes?.search?.(q)) ?? []
    } catch (e) {
      console.warn('[NotesTree] search error', e)
    }
  }, 250)
})

function clearSearch(): void {
  searchText.value = ''
}
```

（`watch` 需从 vue 导入；删除/刷新后若在搜索态需要更新结果：在 `refresh()` 末尾加 `if (searchResults.value !== null && searchText.value.trim()) searchResults.value = (await window.api?.notes?.search?.(searchText.value.trim())) ?? []`。）

- [ ] **Step 2: rows computed 支持搜索态** —— `rows` 开头加：

```typescript
  if (searchResults.value !== null) {
    return searchResults.value.map((n) => ({ kind: 'note' as const, id: n.id, depth: 0, label: n.title }))
  }
```

- [ ] **Step 3: 模板 tree-header 下加搜索框**：

```html
    <div class="search-box">
      <input
        v-model="searchText"
        class="inline-input"
        :placeholder="t('notes.search')"
        @keydown.esc="clearSearch"
      />
      <button v-if="searchText" class="btn-icon" @click="clearSearch">✕</button>
    </div>
```

样式（.tree-header 后）：`.search-box { display: flex; align-items: center; gap: 4px; padding: 2px 10px 6px; }`

搜索态下隐藏「根级新建文件夹表单」无必要——保留现状即可；笔记行的点击/删除在搜索态天然可用。

- [ ] **Step 4: `pnpm --filter @lele/ui typecheck`，提交** `feat(notes): 导航树搜索`

---

### Task 3: 双向滚动联动

**Files:**
- Modify: `packages/ui/src/components/MonacoEditor.vue`、`packages/ui/src/tools/notes/NoteEditor.vue`、`packages/ui/src/tools/notes/NotePreview.vue`、`packages/ui/src/tools/notes/Tool.vue`

- [ ] **Step 1: MonacoEditor.vue**（纯增量）：

emits 改为 `const emit = defineEmits<{ 'update:modelValue': [v: string]; scroll: [ratio: number] }>()`；onMounted 里 editor 创建后加：

```typescript
  editor.onDidScrollChange(() => {
    if (!editor) return
    const max = editor.getScrollHeight() - editor.getLayoutInfo().height
    emit('scroll', max > 0 ? editor.getScrollTop() / max : 0)
  })
```

`insertText` 旁加：

```typescript
/** 按比例设置滚动位置（0~1），供双栏联动 */
function setScrollRatio(r: number): void {
  if (!editor) return
  const max = editor.getScrollHeight() - editor.getLayoutInfo().height
  editor.setScrollTop(Math.max(0, r * max))
}
```

`defineExpose({ insertText, setScrollRatio })`

- [ ] **Step 2: NoteEditor.vue 透传**：

emits 加 `scroll: [ratio: number]`；模板 MonacoEditor 加 `@scroll="emit('scroll', $event)"`；expose 加 `setScrollRatio: (r: number) => editorRef.value?.setScrollRatio(r)`（写成函数声明并入 defineExpose）。

- [ ] **Step 3: NotePreview.vue**：

```typescript
const emit = defineEmits<{ scroll: [ratio: number] }>()
const host = ref<HTMLElement>()

function onScroll(): void {
  const el = host.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  emit('scroll', max > 0 ? el.scrollTop / max : 0)
}

/** 按比例设置滚动位置（0~1），供双栏联动 */
function setScrollRatio(r: number): void {
  const el = host.value
  if (!el) return
  el.scrollTop = r * (el.scrollHeight - el.clientHeight)
}
defineExpose({ setScrollRatio })
```

模板根 div 加 `ref="host" @scroll="onScroll"`（ref 从 vue 导入）。注意 defineExpose 与后续 Task 5 的 getHtml 合并时不要互相覆盖。

- [ ] **Step 4: Tool.vue 协调**：

```typescript
const previewRef = ref<InstanceType<typeof NotePreview>>()

// ── 滚动联动：百分比同步 + 来源锁防回环 ──────────────────────────────────────
let syncSource: 'edit' | 'preview' | null = null
let syncResetTimer: ReturnType<typeof setTimeout> | null = null

function syncFrom(source: 'edit' | 'preview', ratio: number): void {
  if (!showEdit.value || !showPreview.value) return // 单栏时不联动
  if (syncSource && syncSource !== source) return
  syncSource = source
  if (source === 'edit') previewRef.value?.setScrollRatio(ratio)
  else editorRef.value?.setScrollRatio(ratio)
  if (syncResetTimer) clearTimeout(syncResetTimer)
  syncResetTimer = setTimeout(() => {
    syncSource = null
  }, 150)
}
```

模板：NoteEditor 加 `@scroll="syncFrom('edit', $event)"`，NotePreview 加 `ref="previewRef" @scroll="syncFrom('preview', $event)"`。

- [ ] **Step 5: `pnpm typecheck`，提交** `feat(notes): 编辑预览双向滚动联动`

---

### Task 4: PDF 导出主进程

**Files:**
- Modify: `apps/desktop/src/main/ipc/notes.ts`、`packages/shared-types/src/index.ts`、`apps/desktop/src/preload/index.ts`

- [ ] **Step 1: ipc/notes.ts 加导出**（import 增加 `BrowserWindow`；`node:fs` 加 `writeFileSync` 已有）：

```typescript
const PDF_STYLE = `
  body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
         color: #2b2b33; line-height: 1.7; font-size: 14px; margin: 24px 32px; }
  h1 { font-size: 1.5em; border-bottom: 1px solid #d9d9e0; padding-bottom: .25em; }
  h2 { font-size: 1.25em; }
  img, video { max-width: 100%; }
  code { background: #f2f2f5; border: 1px solid #d9d9e0; border-radius: 4px; padding: 1px 5px; font-size: .9em; }
  pre { background: #f2f2f5; border: 1px solid #d9d9e0; border-radius: 6px; padding: 10px 12px; overflow-x: auto; }
  pre code { background: none; border: none; padding: 0; }
  blockquote { margin: .6em 0; padding: 2px 12px; border-left: 3px solid #3b6fd4; color: #71717c; }
  table { border-collapse: collapse; } th, td { border: 1px solid #d9d9e0; padding: 4px 10px; }
  .watermark { position: fixed; inset: -20%; display: flex; flex-wrap: wrap; gap: 90px;
               align-items: center; justify-content: center; pointer-events: none;
               transform: rotate(-30deg); opacity: .12; z-index: 9999; }
  .watermark span { font-size: 26px; color: #000; white-space: nowrap; }
`

function escapeHtml(s: string): string {
  return s.replace(/[&"'<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' })[c] as string)
}

/** 包成可打印的完整 HTML 文档；watermark 非空时加平铺斜排水印（fixed 元素打印时每页重复） */
function buildPdfHtml(title: string, bodyHtml: string, watermark: string): string {
  const wm = watermark
    ? `<div class="watermark">${Array.from({ length: 24 }, () => `<span>${escapeHtml(watermark)}</span>`).join('')}</div>`
    : ''
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PDF_STYLE}</style></head><body>${wm}${bodyHtml}</body></html>`
}
```

registerNotesIpc 里追加：

```typescript
  ipcMain.handle('notes:exportPdf', async (_e, title: string, html: string, watermark: string) => {
    const safeName = (title || '笔记').replace(/[\\/:*?"<>|]/g, '_')
    const result = await dialog.showSaveDialog({
      defaultPath: `${safeName}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (result.canceled || !result.filePath) return null
    const tmp = join(app.getPath('temp'), `lele-note-${Date.now()}.html`)
    writeFileSync(tmp, buildPdfHtml(title, html, watermark))
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    try {
      await win.loadFile(tmp)
      // did-finish-load 后再等一拍，让 notes-file:// 图片完成解码
      await new Promise((r) => setTimeout(r, 300))
      const pdf = await win.webContents.printToPDF({ printBackground: true })
      writeFileSync(result.filePath, pdf)
      return result.filePath
    } finally {
      win.destroy()
      rmSync(tmp, { force: true })
    }
  })
```

注意：渲染层传来的 `html` 是 marked 输出 + 已有转义/白名单（NotePreview 的 renderer），按 v1 同等信任水平直接嵌入；隐藏窗口 sandbox: true 且无 preload，无 Node 暴露。

- [ ] **Step 2: 类型 + preload**

NotesBridge（search 之后）加：`/** 导出当前笔记为 PDF；watermark 空串=不加水印；取消返回 null，成功返回保存路径 */\n  exportPdf(title: string, html: string, watermark: string): Promise<string | null>`
preload notes 加：`exportPdf: (title: string, html: string, watermark: string) => ipcRenderer.invoke('notes:exportPdf', title, html, watermark),`

- [ ] **Step 3: `pnpm typecheck && pnpm test`，提交** `feat(notes): PDF 导出主进程（隐藏窗口 printToPDF + 水印）`

---

### Task 5: PDF 导出 UI

**Files:**
- Modify: `packages/ui/src/tools/notes/NotePreview.vue`（expose getHtml）
- Modify: `packages/ui/src/tools/notes/Tool.vue`（按钮 + 水印面板）
- Modify: `packages/ui/src/i18n.ts`

- [ ] **Step 1: i18n 追加**：

```typescript
  'notes.exportPdf': { zh: '导出 PDF', en: 'Export PDF' },
  'notes.watermark': { zh: '水印', en: 'Watermark' },
  'notes.watermarkText': { zh: '水印文字', en: 'Watermark text' },
  'notes.export': { zh: '导出', en: 'Export' },
  'notes.cancel': { zh: '取消', en: 'Cancel' },
  'notes.exported': { zh: '已导出 ✓', en: 'Exported ✓' },
```

- [ ] **Step 2: NotePreview.vue expose getHtml**：

```typescript
function getHtml(): string {
  return html.value
}
defineExpose({ setScrollRatio, getHtml })
```

- [ ] **Step 3: Tool.vue 加导出面板**：

script 加（localStorage 记忆水印设置）：

```typescript
// ── PDF 导出 ─────────────────────────────────────────────────────────────────
const showExport = ref(false)
const watermarkOn = ref(localStorage.getItem('notes.watermarkOn') === '1')
const watermarkText = ref(localStorage.getItem('notes.watermarkText') ?? '')
const exportMsg = ref('')

async function doExport(): Promise<void> {
  if (!note.value) return
  showExport.value = false
  localStorage.setItem('notes.watermarkOn', watermarkOn.value ? '1' : '0')
  localStorage.setItem('notes.watermarkText', watermarkText.value)
  await flush()
  const html = previewRef.value?.getHtml() ?? ''
  const wm = watermarkOn.value ? watermarkText.value.trim() : ''
  const path = await window.api?.notes?.exportPdf?.(note.value.title || t('notes.untitled'), html, wm)
  if (path) {
    exportMsg.value = t('notes.exported')
    setTimeout(() => {
      exportMsg.value = ''
    }, 3000)
  }
}
```

模板工具条（插入文件按钮后）加：

```html
      <span class="export-wrap">
        <button class="btn" :disabled="!note" @click="showExport = !showExport">{{ t('notes.exportPdf') }}</button>
        <div v-if="showExport" class="export-pop">
          <label class="wm-row"><input v-model="watermarkOn" type="checkbox" /> {{ t('notes.watermark') }}</label>
          <input
            v-if="watermarkOn"
            v-model="watermarkText"
            class="wm-input"
            :placeholder="t('notes.watermarkText')"
            @keydown.enter="doExport"
          />
          <div class="wm-actions">
            <button class="btn primary" @click="doExport">{{ t('notes.export') }}</button>
            <button class="btn" @click="showExport = false">{{ t('notes.cancel') }}</button>
          </div>
        </div>
      </span>
```

`save-state` 显示处把导出消息并入：`{{ exportMsg || (saveState === 'saving' ? t('notes.saving') : saveState === 'saved' ? t('notes.saved') : '') }}`

样式（.notes-tool 内）：

```scss
  .export-wrap { position: relative; }
  .export-pop {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 10;
    background: var(--bg-soft); border: 1px solid var(--border); border-radius: 6px;
    padding: 10px; display: flex; flex-direction: column; gap: 8px; min-width: 200px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    .wm-row { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .wm-input {
      font-size: 12px; padding: 3px 6px; border: 1px solid var(--border); border-radius: 4px;
      background: var(--bg); color: var(--fg); outline: none;
      &:focus { border-color: var(--accent); }
    }
    .wm-actions { display: flex; gap: 6px; justify-content: flex-end; }
  }
```

- [ ] **Step 4: `pnpm typecheck && pnpm test`，提交** `feat(notes): PDF 导出界面（水印面板）`

---

### Task 6: 端到端验证

- [ ] 搜索：输关键词命中标题/正文、清空恢复树、搜索态点开笔记
- [ ] 联动：编辑滚动预览跟随、预览滚动编辑跟随、无来回抖动、单栏关闭时不报错
- [ ] PDF：无水印导出、带水印导出（多页时每页有水印）、含 notes-file 图片的笔记导出后图片在 PDF 里、取消保存对话框返回 null 不报错
- [ ] `pnpm typecheck && pnpm test` 全绿；发现问题修复并把要点追加 `docs/踩坑与要点.md`
