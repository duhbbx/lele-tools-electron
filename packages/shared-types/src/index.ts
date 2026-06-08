/** 渲染层 ↔ 主进程 IPC 契约。preload 实现 window.api，renderer 按此消费。 */

export interface AiFetchRequest {
  url: string
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  /** 字符串 body；调用方负责 JSON.stringify */
  body?: string
  /** 毫秒超时，缺省 60s（流式 120s） */
  timeoutMs?: number
  reqId?: string
}

export interface AiFetchResponse {
  ok: boolean
  status: number
  body: string
  error?: string
}

export interface AiBridge {
  fetch(req: AiFetchRequest): Promise<AiFetchResponse>
  cancel(reqId: string): Promise<boolean>
  stream(
    req: AiFetchRequest & { reqId: string },
    onChunk: (p: { chunk: string }) => void,
  ): Promise<{ ok: boolean; status: number; error?: string }>
}

export interface StoreBridge {
  /** 设置 kv：value 为 JSON 字符串 */
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

export interface RecentsBridge {
  /** 按 last_used 倒序返回 tool id */
  list(limit?: number): Promise<string[]>
  touch(toolId: string): Promise<void>
}

export interface ChatMessageRow {
  id: number
  role: 'user' | 'assistant'
  content: string
  ts: number
}

export interface ChatsBridge {
  list(): Promise<ChatMessageRow[]>
  append(role: 'user' | 'assistant', content: string): Promise<void>
  clear(): Promise<void>
}

export interface MenuBridge {
  onOpenSettings(cb: () => void): void
}

export interface GithubIssuePreview {
  url: string
  owner: string
  repo: string
  number: number
  title: string
  /** markdown body (may be empty string) */
  body: string
  state: 'open' | 'closed'
  error?: string
}

export interface GithubRepoInfo {
  fullName: string
  private: boolean
}

export interface GithubBridge {
  /** Fetch a single issue (title + body); on failure returns preview with error field, never rejects */
  fetchIssue(url: string): Promise<GithubIssuePreview>
  /** List repos owned by the authenticated gh user, sorted by pushed */
  listOwnRepos(): Promise<GithubRepoInfo[]>
  /** Create an issue in fullName (owner/repo); returns the new issue html_url + number */
  createIssue(fullName: string, title: string, body: string): Promise<{ url: string; number: number }>
}

// ── Issue 搬运（instance 化：多源仓库 → 一个目标仓库，issue 拉到本地 sqlite） ──

export type ImRepoKind = 'source' | 'target'

/** 一个搬运配置 = 一个实例（一组源仓库 + 一个目标仓库） */
export interface ImInstance {
  id: number
  name: string
  createdAt: number
  updatedAt: number
}

/** 实例下的仓库；kind=source 可多个，kind=target 至多一个 */
export interface ImRepo {
  id: number
  instanceId: number
  kind: ImRepoKind
  owner: string
  name: string
  /** 该仓库的 GitHub PAT；源仓库（公开库）可留空走 gh CLI / 匿名，目标仓库需写权限 */
  token: string
  /** 上次成功拉取的时间戳（ms）；增量拉取用作 GitHub API 的 since，0=从未拉过/将全量 */
  lastPulledAt: number
  createdAt: number
}

/** 一条 issue 记录（源仓库与目标仓库的 issue 都进这张表） */
export interface ImIssue {
  id: number
  instanceId: number
  repoId: number
  kind: ImRepoKind
  /** 远端 issue 编号 */
  number: number
  title: string
  body: string
  state: 'open' | 'closed'
  /** issue 链接 */
  htmlUrl: string
  /** 源 issue：是否已搬运到目标库 */
  migrated: boolean
  /** 目标 issue：由哪条源 im_issues.id 搬来（我们建的才有，远端原有的为 null） */
  sourceIssueId: number | null
  /** AI 解读（缓存，空串=未解读过）；重新拉取不覆盖 */
  aiExplain: string
  remoteCreatedAt: number
  fetchedAt: number
}

export interface ImRepoInput {
  kind: ImRepoKind
  owner: string
  name: string
  token?: string
}

export interface IssueMoverBridge {
  instances: {
    list(): Promise<ImInstance[]>
    get(id: number): Promise<ImInstance | null>
    create(name: string): Promise<number>
    rename(id: number, name: string): Promise<void>
    remove(id: number): Promise<void>
  }
  repos: {
    listByInstance(instanceId: number): Promise<ImRepo[]>
    add(instanceId: number, r: ImRepoInput): Promise<number>
    update(id: number, r: { owner: string; name: string; token: string }): Promise<void>
    remove(id: number): Promise<void>
    /** 拉取该仓库远端 issue → upsert 落库（默认增量，full=true 强制全量）；失败 ok=false（不 reject） */
    pull(id: number, full?: boolean): Promise<{ ok: boolean; count?: number; incremental?: boolean; error?: string }>
  }
  issues: {
    listByRepo(repoId: number): Promise<ImIssue[]>
    listByInstance(instanceId: number, kind: ImRepoKind): Promise<ImIssue[]>
    /** 把某条源 issue 在目标仓库真建一条 issue，回写映射并标记已搬运；失败 ok=false（不 reject） */
    migrate(sourceIssueId: number): Promise<{ ok: boolean; url?: string; number?: number; error?: string }>
    /** 缓存 AI 解读到该 issue（渲染层流式生成完成后落库） */
    setExplain(id: number, text: string): Promise<void>
  }
}

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
  /** 标题+全文 LIKE 搜索 */
  search(query: string): Promise<NoteListItem[]>
  /** 导出当前笔记为 PDF；watermark 空串=不加水印；取消返回 null，成功返回保存路径 */
  exportPdf(title: string, html: string, watermark: string): Promise<string | null>
  get(id: number): Promise<Note | null>
  /** 新建空笔记，返回 id */
  create(folderId: number | null): Promise<number>
  /** title 由渲染层从 content 提取后传入 */
  update(id: number, content: string, title: string): Promise<void>
  move(id: number, folderId: number | null): Promise<void>
  /** 软删进回收站（附件保留，彻底删除时才清理） */
  remove(id: number): Promise<void>
  trash: {
    list(): Promise<NoteListItem[]>
    /** 原文件夹还在则原位恢复，已删则回根目录 */
    restore(id: number): Promise<void>
    /** 彻底删除并清理 userData/notes-files/<id>/ */
    removeForever(id: number): Promise<void>
    /** 清空回收站（含附件目录） */
    empty(): Promise<void>
  }
  files: {
    /** 弹系统文件选择框（kind=image 时只给图片过滤器）→ 拷贝到 userData/notes-files/<noteId>/ → 入库；取消返回 null */
    pick(noteId: number, kind: 'image' | 'file'): Promise<NoteFile | null>
    /** 剪贴板/拖拽来的二进制数据落盘入库 */
    paste(noteId: number, name: string, mime: string, data: Uint8Array): Promise<NoteFile | null>
    /** 按本地路径拷贝入库（拖拽文件用） */
    importPath(noteId: number, path: string): Promise<NoteFile | null>
    /** 系统默认程序打开附件 */
    open(id: number): Promise<void>
  }
  /** 拖拽的 File 对象 → 本地绝对路径（webUtils.getPathForFile，同步） */
  fileToPath(file: File): string
}

// ── 构建期插件契约（plugins/<id>/，见 docs/superpowers/specs/plugin-architecture.md） ──

export interface PluginMainContext {
  /** better-sqlite3 Database；shared-types 不依赖其类型，两侧各自收窄 */
  getDb(): unknown
}

/** plugins/<id>/main/index.ts 的导出契约（export const plugin: LelePluginMain） */
export interface LelePluginMain {
  /** 插件 id，同时是 plugin-file://<id>/ 的 hostname */
  id: string
  /** 基础 migrate 之后调用；自管 CREATE TABLE IF NOT EXISTS + 守护补列（幂等） */
  migrate?(db: unknown): void
  registerIpc?(ctx: PluginMainContext): void
  /** plugin-file://<id>/... 的本地文件解析器（渲染层 <img> 等用） */
  resolveFile?(url: URL): Response | Promise<Response>
}

export interface PluginBridge {
  /** 通用 IPC 透传；插件渲染层据此包自己的带类型客户端 */
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
}

export interface WindowApi {
  ai: AiBridge
  store: StoreBridge
  recents: RecentsBridge
  chats: ChatsBridge
  menu: MenuBridge
  github: GithubBridge
  issueMover: IssueMoverBridge
  notes: NotesBridge
  plugin: PluginBridge
}
