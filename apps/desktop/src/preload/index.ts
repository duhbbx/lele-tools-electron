import { contextBridge, ipcRenderer } from 'electron'
import type { WindowApi } from '@lele/shared-types'

const api: Pick<WindowApi, 'store' | 'recents' | 'chats'> = {
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
}

contextBridge.exposeInMainWorld('api', api)
