import { ipcMain } from 'electron'
import { chatsStore, recentsStore, settingsStore } from '../db/stores'

export function registerStoreIpc(): void {
  ipcMain.handle('store:get', (_e, key: string) => settingsStore.get(key))
  ipcMain.handle('store:set', (_e, key: string, value: string) => settingsStore.set(key, value))
  ipcMain.handle('recents:list', (_e, limit?: number) => recentsStore.list(limit))
  ipcMain.handle('recents:touch', (_e, toolId: string) => recentsStore.touch(toolId))
  ipcMain.handle('chats:list', () => chatsStore.list())
  ipcMain.handle('chats:append', (_e, role: 'user' | 'assistant', content: string) =>
    chatsStore.append(role, content),
  )
  ipcMain.handle('chats:clear', () => chatsStore.clear())
}
