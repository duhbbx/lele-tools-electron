# Markdown 记事本（notes 模块）设计文档

日期：2026-06-06
状态：已确认

## 目标

在 lele-tools-electron 中新增一个「Markdown 记事本」工具：树状导航管理笔记，Markdown 双栏编辑（编辑/预览各自可开关），支持插入图片/文件/多媒体，数据本地持久化。

## 整体形态

作为新工具 `notes` 注册到 `packages/ui/src/tools/`，出现在外层 SideNav 工具列表中，点开后在标签页内打开。**外层 SideNav 只是工具入口；笔记自己的导航树在工具内部**，两者互不相干。

工具内部三段式布局：

```
┌──────────────┬──────────────────┬──────────────────┐
│ 笔记导航树     │  Monaco 编辑器    │   预览（marked）  │
│ 220px 可折叠  │                  │                  │
├──────────────┴──────────────────┴──────────────────┤
│ 工具条：[插入图片] [插入文件] [编辑⇄] [⇄预览] 保存状态 │
└─────────────────────────────────────────────────────┘
```

- 编辑栏 / 预览栏各自可开关：双栏、只编辑、只预览三种状态；不允许两栏全关（至少保留一栏）。
- 导航树可折叠。
- 样式复用项目 CSS 变量（`--bg` / `--bg-soft` / `--bg-hover` / `--fg` / `--fg-dim` / `--border` / `--accent` / `--danger`），自动适配明暗主题；不引入 UI 框架，与 CRM / AI 面板风格一致。

## 数据模型（better-sqlite3，进现有 lele.db，migration 写在 schema.ts）

```sql
notes_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NULL REFERENCES notes_folders(id) ON DELETE CASCADE,  -- NULL = 根
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id INTEGER NULL REFERENCES notes_folders(id) ON DELETE CASCADE,  -- NULL = 根
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
notes_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stored_path TEXT NOT NULL,   -- 相对 userData 的路径
  mime TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

### title 自动生成规则

每次保存时重算（纯函数，可单测）：

1. 取内容第一个 `#` 一级标题文本；
2. 没有一级标题则取第一行非空文本（剥掉 Markdown 标记符）；
3. 全空显示「无标题」；
4. 统一截断到 20 个字符。

导航树上的标题实时随保存更新。

### 自动保存

编辑停顿 800ms 后 debounce 写库；工具条显示「已保存 ✓ / 保存中…」状态；切换笔记、关闭工具前 flush 未保存内容。无手动保存按钮。

## 附件（图片 / 文件 / 多媒体）

照搬 CRM 文件模式，附件拷贝到 `userData/notes-files/<noteId>/`，同名冲突加时间戳前缀。

- **插入图片**：三种方式 —— 工具条按钮选文件、剪贴板粘贴（截图）、拖拽进编辑器。落盘后在光标处插入 `![name](notes-file://<id>/<name>)`。
- **插入文件**：插入链接 `[name](notes-file://<id>/<name>)`，预览中点击用系统默认程序打开（shell.openPath）。
- **多媒体**：音频/视频按扩展名在预览中渲染为 `<audio>` / `<video>` 标签。
- **notes-file:// 协议**：主进程 `protocol.handle` 注册，按附件 id 查库映射到磁盘路径，校验路径必须落在 notes-files 目录内（防穿越）。
- **删除清理**：删笔记 → 同步删 `userData/notes-files/<noteId>/` 目录；删文件夹 → 级联删所有子孙笔记及其附件目录。

## IPC（沿用 crm: 的 `模块:实体:操作` 命名约定）

```
notes:folders:list / create / rename / move / remove
notes:list（含树需要的 id/folder_id/title）/ get / create / update / move / remove
notes:files:pick(noteId)            -- 对话框选文件
notes:files:paste(noteId, buffer, mime)  -- 剪贴板/拖拽数据
notes:files:remove(id)
```

- 主进程新增 `main/ipc/notes.ts`（registerNotesIpc）+ `main/db/notesStore.ts`，在 main/index.ts 注册。
- preload 挂 `window.api.notes`，类型加进 shared-types。

## 导航树交互（参考 CrmTree.vue）

- 文件夹任意嵌套：展开/折叠（▾▸）、内联新建文件夹/笔记、重命名、两步确认删除（3 秒超时，CRM 同款）。
- 笔记/文件夹可拖拽移动到其他文件夹或根。
- 点笔记加载内容到编辑器；切换前 flush。

## 组件结构（packages/ui/src/tools/notes/）

```
notes/
├── meta.ts          -- 工具注册元数据（category: 'text'，icon 📝）
├── Tool.vue         -- 三段布局容器 + 栏开关 + 状态
├── NotesTree.vue    -- 笔记导航树
├── NoteEditor.vue   -- Monaco 编辑 + 粘贴/拖拽处理 + 工具条
├── NotePreview.vue  -- marked 渲染 + 媒体标签 + 文件链接点击
└── title.ts         -- title 提取纯函数
```

在 `tools/index.ts` 导入 meta 并加入 TOOLS 数组。

## 测试

- `title.ts`：vitest 单测覆盖一级标题/无标题取首行/全空/20 字截断。
- `notesStore`：内存 SQLite 单测 CRUD、级联删除（folders→notes→files 记录），与 CRM store 测试同套路。

## 顺带任务：CLAUDE.md

为 lele-tools-electron 根目录补一份 CLAUDE.md：monorepo 结构、新增工具流程、IPC/DB/preload 模式约定、开发命令（含 macOS 原生模块编译需 `PYTHON=python3.9`）、设计规范（CSS 变量主题、无 UI 框架、emoji 图标）。
