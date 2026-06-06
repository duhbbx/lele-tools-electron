import { contextBridge, ipcRenderer, webUtils } from 'electron'
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
    search: (query: string) => ipcRenderer.invoke('notes:search', query),
    exportPdf: (title: string, html: string, watermark: string) => ipcRenderer.invoke('notes:exportPdf', title, html, watermark),
    get: (id: number) => ipcRenderer.invoke('notes:get', id),
    create: (folderId: number | null) => ipcRenderer.invoke('notes:create', folderId),
    update: (id: number, content: string, title: string) =>
      ipcRenderer.invoke('notes:update', id, content, title),
    move: (id: number, folderId: number | null) => ipcRenderer.invoke('notes:move', id, folderId),
    remove: (id: number) => ipcRenderer.invoke('notes:remove', id),
    trash: {
      list: () => ipcRenderer.invoke('notes:trash:list'),
      restore: (id: number) => ipcRenderer.invoke('notes:trash:restore', id),
      removeForever: (id: number) => ipcRenderer.invoke('notes:trash:removeForever', id),
      empty: () => ipcRenderer.invoke('notes:trash:empty'),
    },
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
  plugin: {
    /** 通用 IPC 透传：构建期插件的渲染层据此包自己的带类型客户端（频道命名 模块:实体:操作） */
    invoke: (channel: string, ...args: unknown[]) => {
      if (!/^[a-z][\w-]*:[\w:.-]+$/i.test(channel)) {
        return Promise.reject(new Error(`invalid plugin channel: ${channel}`))
      }
      return ipcRenderer.invoke(channel, ...args)
    },
  },
}

contextBridge.exposeInMainWorld('api', api)
