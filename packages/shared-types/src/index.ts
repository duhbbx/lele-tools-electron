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

export interface CrmClient { id: number; name: string; type: 'company' | 'person'; note: string; createdAt: number }
export interface CrmContact { id: number; clientId: number; name: string; role: string; phone: string; wechat: string; email: string; note: string; createdAt: number }
export interface CrmProjectLite { id: number; name: string; status: string }
export interface CrmProject {
  id: number; clientId: number; name: string; status: 'active' | 'done'
  description: string; serverAddr: string; domain: string; adminUrl: string; adminUser: string; adminPass: string
  wxAppId: string; wxAppSecret: string; wxPayParams: string
  amountCents: number; endDate: string; createdAt: number; updatedAt: number
}
export interface CrmPayment { id: number; projectId: number; amountCents: number; paidAt: string; note: string }
export interface CrmFile { id: number; projectId: number; name: string; storedPath: string; size: number; uploadedAt: number }

export interface CrmBridge {
  clients: {
    list(): Promise<CrmClient[]>
    create(name: string, type: 'company' | 'person'): Promise<number>
    update(id: number, c: { name: string; type: 'company' | 'person'; note: string }): Promise<void>
    remove(id: number): Promise<void>
  }
  contacts: {
    listByClient(clientId: number): Promise<CrmContact[]>
    get(id: number): Promise<CrmContact | null>
    create(clientId: number, name: string): Promise<number>
    update(id: number, c: Omit<CrmContact, 'id' | 'clientId' | 'createdAt'>): Promise<void>
    remove(id: number): Promise<void>
  }
  projects: {
    listByClient(clientId: number): Promise<CrmProjectLite[]>
    get(id: number): Promise<CrmProject | null>
    create(clientId: number, name: string): Promise<number>
    update(id: number, p: Omit<CrmProject, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>): Promise<void>
    remove(id: number): Promise<void>
  }
  payments: {
    listByProject(projectId: number): Promise<CrmPayment[]>
    add(projectId: number, p: { amountCents: number; paidAt: string; note: string }): Promise<number>
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

export interface WindowApi {
  ai: AiBridge
  store: StoreBridge
  recents: RecentsBridge
  chats: ChatsBridge
  menu: MenuBridge
  github: GithubBridge
  crm: CrmBridge
}
