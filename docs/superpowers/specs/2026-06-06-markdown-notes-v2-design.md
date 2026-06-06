# Markdown 记事本 v2 增强设计（搜索 / 滚动联动 / PDF 导出）

日期：2026-06-06
状态：已确认
前置：`2026-06-06-markdown-notes-design.md`（v1 已交付）

## 1. 树内搜索（标题 + 全文）

- store 加 `notes.search(query)`：`SELECT id, folder_id, title, updated_at FROM notes WHERE title LIKE ? ESCAPE '\' OR content LIKE ? ESCAPE '\' ORDER BY updated_at DESC`，入参转义 `\ % _`。
- IPC `notes:search(query)` + preload + NotesBridge 加 `search(query): Promise<NoteListItem[]>`。
- NotesTree 头部下方加搜索框（250ms debounce）：
  - 有关键词 → 树区域切换为扁平匹配结果列表（📄 行，支持点击打开与两步删除）；
  - 清空（或 Esc）→ 恢复树状视图。

## 2. 编辑 ⇄ 预览双向滚动联动

- 按滚动百分比同步（已知局限：长文档中段落级对不齐，接受）。
- `MonacoEditor.vue`：`onDidScrollChange` → emit `scroll(ratio)`；expose `setScrollRatio(r)`。纯增量，不影响其他工具。
- `NoteEditor.vue`：透传 scroll 事件 + 透传 expose `setScrollRatio`。
- `NotePreview.vue`：容器 `@scroll` → emit `scroll(ratio)`；expose `setScrollRatio(r)`。
- `Tool.vue` 协调：`syncFrom(source, ratio)`，`syncSource` 标志 + 150ms 复位定时器防回环；编辑/预览任一隐藏时不同步。

## 3. 导出 PDF（可选水印）

- 工具条加「导出 PDF」按钮（无选中笔记时禁用）→ 弹内联小面板：水印开关 + 水印文字输入（localStorage 记住上次值）→ 确认导出。
- `NotePreview.vue` expose `getHtml()` 返回当前渲染 HTML。
- IPC `notes:exportPdf(title, html, watermark)`（watermark 空串 = 不加）：
  1. `dialog.showSaveDialog`（默认名 `<title>.pdf`，title 里非法文件名字符替换为 `_`），取消返回 null；
  2. 生成完整打印 HTML 文档（浅色打印样式、`notes-file://` 图片可直接加载；水印为 `position: fixed` 斜排平铺半透明文字，Chromium 打印时每页重复）；标题与水印文字插值前 HTML 转义；
  3. 写临时 html 文件（避免 data URL 体积限制）→ 隐藏 BrowserWindow `loadFile` → 等资源加载（did-finish-load + 300ms）→ `printToPDF({ printBackground: true })` → 写入目标路径；
  4. finally 销毁隐藏窗口、删临时文件；返回保存路径。
- 导出成功后工具条短暂显示「已导出 ✓」。

## 测试

- `notes.search`：标题命中 / 正文命中 / `%_` 转义 / 无命中，内存库单测。
- 滚动联动与 PDF 导出为 UI/集成行为，走端到端验证清单。
