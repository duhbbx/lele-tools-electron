import { contextBridge, ipcRenderer } from 'electron'
import type { WindowApi } from '@lele/shared-types'

const api: WindowApi = {
  ai: {
    /** 经主进程做 HTTP；避开渲染层 CORS（DeepSeek/OpenAI/Grok 直发会被预检卡）；
     *  请求 id 可选，传了之后可通过 ai.cancel(id) 真正中止主进程的 fetch。 */
    fetch: (req: {
      url: string
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      headers?: Record<string, string>
      body?: string
      timeoutMs?: number
      reqId?: string
    }): Promise<{ ok: boolean; status: number; body: string; error?: string }> =>
      ipcRenderer.invoke('ai:fetch', req),
    /** 终止还在飞的请求；返回 true 表示找到并取消了 */
    cancel: (reqId: string): Promise<boolean> => ipcRenderer.invoke('ai:cancel', reqId),
    /** 流式：主进程逐块把 raw SSE 文本经 `ai:stream:<reqId>` 推回，onChunk 收；
     *  invoke 在流结束 / 出错时 resolve。SSE 解析在渲染层做。 */
    stream: (
      req: {
        url: string
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
        headers?: Record<string, string>
        body?: string
        timeoutMs?: number
        reqId: string
      },
      onChunk: (payload: { chunk: string }) => void,
    ): Promise<{ ok: boolean; status: number; error?: string }> => {
      const channel = `ai:stream:${req.reqId}`
      const listener = (_e: Electron.IpcRendererEvent, payload: { chunk: string }): void =>
        onChunk(payload)
      ipcRenderer.on(channel, listener)
      return ipcRenderer
        .invoke('ai:stream', req)
        .finally(() => ipcRenderer.removeListener(channel, listener))
    },
  },
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
  },
  recents: {
    list: (limit) => ipcRenderer.invoke('recents:list', limit),
    touch: (toolId) => ipcRenderer.invoke('recents:touch', toolId),
  },
  chats: {
    list: () => ipcRenderer.invoke('chats:list'),
    append: (role, content) => ipcRenderer.invoke('chats:append', role, content),
    clear: () => ipcRenderer.invoke('chats:clear'),
  },
  menu: {
    onOpenSettings: (cb: () => void): void => {
      ipcRenderer.on('menu:open-settings', () => cb())
    },
  },
  github: {
    fetchIssue: (url: string) => ipcRenderer.invoke('github:fetch-issue', url),
    listOwnRepos: () => ipcRenderer.invoke('github:list-repos'),
    createIssue: (fullName: string, title: string, body: string) =>
      ipcRenderer.invoke('github:create-issue', fullName, title, body),
  },
  crm: {
    clients: {
      list: () => ipcRenderer.invoke('crm:clients:list'),
      create: (name: string, type: 'company' | 'person') =>
        ipcRenderer.invoke('crm:clients:create', name, type),
      update: (id: number, c: { name: string; type: 'company' | 'person'; note: string }) =>
        ipcRenderer.invoke('crm:clients:update', id, c),
      remove: (id: number) => ipcRenderer.invoke('crm:clients:remove', id),
    },
    contacts: {
      listByClient: (clientId: number) =>
        ipcRenderer.invoke('crm:contacts:listByClient', clientId),
      get: (id: number) => ipcRenderer.invoke('crm:contacts:get', id),
      create: (clientId: number, name: string) =>
        ipcRenderer.invoke('crm:contacts:create', clientId, name),
      update: (
        id: number,
        c: {
          name: string
          role: string
          phone: string
          wechat: string
          email: string
          note: string
        },
      ) => ipcRenderer.invoke('crm:contacts:update', id, c),
      remove: (id: number) => ipcRenderer.invoke('crm:contacts:remove', id),
    },
    projects: {
      listByClient: (clientId: number) =>
        ipcRenderer.invoke('crm:projects:listByClient', clientId),
      get: (id: number) => ipcRenderer.invoke('crm:projects:get', id),
      create: (clientId: number, name: string) =>
        ipcRenderer.invoke('crm:projects:create', clientId, name),
      update: (
        id: number,
        p: {
          name: string
          status: 'active' | 'done'
          description: string
          serverAddr: string
          domain: string
          adminUrl: string
          adminUser: string
          adminPass: string
          wxAppId: string
          wxAppSecret: string
          wxPayParams: string
          amountCents: number
          endDate: string
        },
      ) => ipcRenderer.invoke('crm:projects:update', id, p),
      remove: (id: number) => ipcRenderer.invoke('crm:projects:remove', id),
    },
    payments: {
      listByProject: (projectId: number) =>
        ipcRenderer.invoke('crm:payments:listByProject', projectId),
      add: (projectId: number, p: { amountCents: number; paidAt: string; note: string }) =>
        ipcRenderer.invoke('crm:payments:add', projectId, p),
      remove: (id: number) => ipcRenderer.invoke('crm:payments:remove', id),
    },
    files: {
      listByProject: (projectId: number) =>
        ipcRenderer.invoke('crm:files:listByProject', projectId),
      pick: (projectId: number) => ipcRenderer.invoke('crm:files:pick', projectId),
      open: (id: number) => ipcRenderer.invoke('crm:files:open', id),
      remove: (id: number) => ipcRenderer.invoke('crm:files:remove', id),
    },
  },
}

contextBridge.exposeInMainWorld('api', api)
