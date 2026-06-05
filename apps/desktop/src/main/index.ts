import { join } from 'node:path'
import { BrowserWindow, app, shell } from 'electron'
import { closeDb } from './db/sqlite'
import { registerAiIpc } from './ipc/ai'
import { registerGithubIpc } from './ipc/github'
import { registerStoreIpc } from './ipc/store'
import { setupMenu } from './menu'

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    title: isDev ? '[DEV] 乐乐的工具箱' : '乐乐的工具箱',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.on('ready-to-show', () => win.show())
  // 外链一律走系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (isDev && rendererUrl) void win.loadURL(rendererUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

app.whenReady().then(() => {
  setupMenu()
  registerStoreIpc()
  registerAiIpc()
  registerGithubIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})
