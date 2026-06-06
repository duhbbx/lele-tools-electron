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

/** 客户来源标记；空串=未填 */
export type CrmClientSource =
  | '' | 'xiaohongshu' | 'xianyu' | 'referral' | 'wechat' | 'github' | 'website' | 'other'
/** 收款方式；空串=未填 */
export type CrmPaymentMethod = '' | 'bank' | 'wechat' | 'alipay' | 'other'

export interface CrmClient {
  id: number; name: string; type: 'company' | 'person'; note: string
  phone: string; email: string
  legalPerson: string; legalPersonPhone: string; uscc: string; regAddress: string; establishedDate: string
  source: CrmClientSource
  createdAt: number
}
export interface CrmContact { id: number; clientId: number; name: string; role: string; phone: string; wechat: string; email: string; sex: '' | 'male' | 'female'; note: string; createdAt: number }
export interface CrmProjectLite { id: number; name: string; status: string }
export interface CrmProject {
  id: number; clientId: number; name: string; status: 'active' | 'done'
  description: string; serverAddr: string; domain: string; adminUrl: string; adminUser: string; adminPass: string
  wxAppId: string; wxAppSecret: string; wxPayParams: string
  amountCents: number; shareCents: number; endDate: string; createdAt: number; updatedAt: number
}
export interface CrmPayment { id: number; projectId: number; amountCents: number; paidAt: string; method: CrmPaymentMethod; note: string }
export interface CrmFile { id: number; projectId: number; name: string; storedPath: string; size: number; uploadedAt: number }

export interface CrmClientFilter { q?: string; type?: 'company' | 'person' }
export interface CrmContactFilter { q?: string; clientId?: number }
export interface CrmProjectFilter { q?: string; status?: 'active' | 'done'; clientId?: number }
export interface CrmContactWithClient extends CrmContact { clientName: string }
export interface CrmProjectListItem {
  id: number; clientId: number; name: string; status: 'active' | 'done'
  clientName: string; amountCents: number; shareCents: number; endDate: string
}

export interface CrmClientInput {
  name: string; type: 'company' | 'person'
  note?: string; phone?: string; email?: string
  legalPerson?: string; legalPersonPhone?: string; uscc?: string; regAddress?: string; establishedDate?: string
  source?: CrmClientSource
}
export interface CrmContactInput {
  name: string
  role?: string; phone?: string; wechat?: string; email?: string; sex?: '' | 'male' | 'female'; note?: string
}
export interface CrmProjectInput {
  name: string
  status?: 'active' | 'done'; description?: string; amountCents?: number; shareCents?: number; endDate?: string
}

export interface CrmBridge {
  clients: {
    list(f?: CrmClientFilter): Promise<CrmClient[]>
    get(id: number): Promise<CrmClient | null>
    create(c: CrmClientInput): Promise<number>
    update(id: number, c: Omit<CrmClient, 'id' | 'createdAt'>): Promise<void>
    remove(id: number): Promise<void>
  }
  contacts: {
    listByClient(clientId: number): Promise<CrmContact[]>
    listAll(f?: CrmContactFilter): Promise<CrmContactWithClient[]>
    get(id: number): Promise<CrmContact | null>
    create(clientId: number, c: CrmContactInput): Promise<number>
    update(id: number, c: Omit<CrmContact, 'id' | 'clientId' | 'createdAt'>): Promise<void>
    remove(id: number): Promise<void>
  }
  projects: {
    listByClient(clientId: number): Promise<CrmProjectLite[]>
    listAll(f?: CrmProjectFilter): Promise<CrmProjectListItem[]>
    get(id: number): Promise<CrmProject | null>
    create(clientId: number, p: CrmProjectInput): Promise<number>
    update(id: number, p: Omit<CrmProject, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>): Promise<void>
    remove(id: number): Promise<void>
  }
  payments: {
    listByProject(projectId: number): Promise<CrmPayment[]>
    add(projectId: number, p: { amountCents: number; paidAt: string; method: CrmPaymentMethod; note: string }): Promise<number>
    remove(id: number): Promise<void>
  }
  files: {
    listByProject(projectId: number): Promise<CrmFile[]>
    /** 弹系统文件选择框 → 拷贝到 userData/crm-files/<projectId>/ → 入库；取消返回 null */
    pick(projectId: number): Promise<CrmFile | null>
    open(id: number): Promise<void>
    remove(id: number): Promise<void>
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
  /** 删笔记并清理 userData/notes-files/<id>/ */
  remove(id: number): Promise<void>
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
