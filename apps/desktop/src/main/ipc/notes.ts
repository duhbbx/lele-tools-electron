import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, app, dialog, ipcMain, net, protocol, shell } from 'electron'
import { makeNotesStore } from '../db/notesStore'
import { getDb } from '../db/sqlite'

let _store: ReturnType<typeof makeNotesStore> | null = null
function s(): ReturnType<typeof makeNotesStore> {
  if (_store === null) _store = makeNotesStore(getDb())
  return _store
}

function notesDir(): string {
  return join(app.getPath('userData'), 'notes-files')
}

function removeNoteDirs(noteIds: number[]): void {
  for (const id of noteIds) {
    rmSync(join(notesDir(), String(id)), { recursive: true, force: true })
  }
}

const EXT_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  pdf: 'application/pdf',
}

function mimeFor(name: string): string {
  return EXT_MIME[extname(name).slice(1).toLowerCase()] ?? ''
}

/** 把内容写进 userData/notes-files/<noteId>/，同名加时间戳前缀，入库并返回行 */
function storeFile(
  noteId: number,
  srcName: string,
  write: (dest: string) => void,
  mime: string,
) {
  const dir = join(notesDir(), String(noteId))
  mkdirSync(dir, { recursive: true })
  // 防写侧路径穿越：渲染层传来的文件名可能含 ".."，basename 确保只取最终分量
  let destName = basename(srcName)
  if (existsSync(join(dir, destName))) destName = `${Date.now()}-${destName}`
  const dest = join(dir, destName)
  write(dest)
  const size = statSync(dest).size
  const storedPath = relative(app.getPath('userData'), dest)
  const id = s().files.add(noteId, { name: destName, storedPath, mime, size })
  return s().files.get(id)
}

const PDF_STYLE = `
  body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
         color: #2b2b33; line-height: 1.7; font-size: 14px; margin: 24px 32px; }
  h1 { font-size: 1.5em; border-bottom: 1px solid #d9d9e0; padding-bottom: .25em; }
  h2 { font-size: 1.25em; }
  img, video { max-width: 100%; }
  code { background: #f2f2f5; border: 1px solid #d9d9e0; border-radius: 4px; padding: 1px 5px; font-size: .9em; }
  pre { background: #f2f2f5; border: 1px solid #d9d9e0; border-radius: 6px; padding: 10px 12px; overflow-x: auto; }
  pre code { background: none; border: none; padding: 0; }
  blockquote { margin: .6em 0; padding: 2px 12px; border-left: 3px solid #3b6fd4; color: #71717c; }
  table { border-collapse: collapse; } th, td { border: 1px solid #d9d9e0; padding: 4px 10px; }
  .watermark { position: fixed; inset: -20%; display: flex; flex-wrap: wrap; gap: 90px;
               align-items: center; justify-content: center; pointer-events: none;
               transform: rotate(-30deg); opacity: .12; z-index: 9999; }
  .watermark span { font-size: 26px; color: #000; white-space: nowrap; }
`

function escapeHtml(s: string): string {
  return s.replace(/[&"'<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' })[c] as string)
}

/** 包成可打印的完整 HTML 文档；watermark 非空时加平铺斜排水印（fixed 元素打印时每页重复） */
function buildPdfHtml(title: string, bodyHtml: string, watermark: string): string {
  const wm = watermark
    ? `<div class="watermark">${Array.from({ length: 24 }, () => `<span>${escapeHtml(watermark)}</span>`).join('')}</div>`
    : ''
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'self' notes-file:; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' notes-file:; media-src 'self' notes-file:">`
  return `<!doctype html><html><head><meta charset="utf-8">${csp}<title>${escapeHtml(title)}</title><style>${PDF_STYLE}</style></head><body>${wm}${bodyHtml}</body></html>`
}

/** app ready 之后调用：notes-file://<fileId>/<name> → 附件目录里的真实文件
 *  （scheme 特权声明集中在 ../schemes.ts 的 registerAppSchemes） */
export function registerNotesProtocol(): void {
  protocol.handle('notes-file', (request) => {
    const id = Number(new URL(request.url).hostname)
    const row = Number.isInteger(id) && id > 0 ? s().files.get(id) : null
    if (!row) return new Response('not found', { status: 404 })
    const abs = resolve(app.getPath('userData'), row.storedPath)
    // 防路径穿越：必须落在附件目录内
    if (!abs.startsWith(notesDir() + sep)) return new Response('forbidden', { status: 403 })
    return net.fetch(pathToFileURL(abs).toString())
  })
}

export function registerNotesIpc(): void {
  // folders
  ipcMain.handle('notes:folders:list', () => s().folders.list())
  ipcMain.handle('notes:folders:create', (_e, parentId: number | null, name: string) =>
    s().folders.create(parentId, name),
  )
  ipcMain.handle('notes:folders:rename', (_e, id: number, name: string) =>
    s().folders.rename(id, name),
  )
  ipcMain.handle('notes:folders:move', (_e, id: number, parentId: number | null) =>
    s().folders.move(id, parentId),
  )
  // 删文件夹：子树笔记进回收站（附件保留，彻底删除时才清理）
  ipcMain.handle('notes:folders:remove', (_e, id: number) => s().folders.remove(id))

  // notes
  ipcMain.handle('notes:list', () => s().notes.list())
  ipcMain.handle('notes:search', (_e, query: string) => s().notes.search(query))
  ipcMain.handle('notes:get', (_e, id: number) => s().notes.get(id))
  ipcMain.handle('notes:create', (_e, folderId: number | null) => s().notes.create(folderId))
  ipcMain.handle('notes:update', (_e, id: number, content: string, title: string) =>
    s().notes.update(id, { title, content }),
  )
  ipcMain.handle('notes:move', (_e, id: number, folderId: number | null) =>
    s().notes.move(id, folderId),
  )
  // 软删进回收站，附件目录保留
  ipcMain.handle('notes:remove', (_e, id: number) => s().notes.remove(id))

  // trash
  ipcMain.handle('notes:trash:list', () => s().trash.list())
  ipcMain.handle('notes:trash:restore', (_e, id: number) => s().trash.restore(id))
  ipcMain.handle('notes:trash:removeForever', (_e, id: number) => {
    s().trash.removeForever(id)
    removeNoteDirs([id])
  })
  ipcMain.handle('notes:trash:empty', () => {
    const ids = s().trash.empty()
    removeNoteDirs(ids)
  })

  // files
  ipcMain.handle('notes:files:pick', async (_e, noteId: number, kind: 'image' | 'file') => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters:
        kind === 'image'
          ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }]
          : [],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const src = result.filePaths[0]
    return storeFile(noteId, basename(src), (dest) => copyFileSync(src, dest), mimeFor(src))
  })

  ipcMain.handle(
    'notes:files:paste',
    (_e, noteId: number, name: string, mime: string, data: Uint8Array) =>
      storeFile(noteId, name, (dest) => writeFileSync(dest, data), mime || mimeFor(name)),
  )

  ipcMain.handle('notes:files:importPath', (_e, noteId: number, path: string) => {
    if (!existsSync(path)) return null
    return storeFile(noteId, basename(path), (dest) => copyFileSync(path, dest), mimeFor(path))
  })

  ipcMain.handle('notes:files:open', async (_e, id: number) => {
    const row = s().files.get(id)
    if (!row) return
    await shell.openPath(join(app.getPath('userData'), row.storedPath))
  })

  ipcMain.handle('notes:exportPdf', async (_e, title: string, html: string, watermark: string) => {
    const safeName = (title || '笔记').replace(/[\\/:*?"<>|]/g, '_')
    const result = await dialog.showSaveDialog({
      defaultPath: `${safeName}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (result.canceled || !result.filePath) return null
    const tmp = join(app.getPath('temp'), `lele-note-${Date.now()}.html`)
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } })
    try {
      writeFileSync(tmp, buildPdfHtml(title, html, watermark))
      await win.loadFile(tmp)
      // did-finish-load 后再等一拍，让 notes-file:// 图片完成解码
      await new Promise((r) => setTimeout(r, 300))
      const pdf = await win.webContents.printToPDF({ printBackground: true })
      writeFileSync(result.filePath, pdf)
      return result.filePath
    } finally {
      win.destroy()
      rmSync(tmp, { force: true })
    }
  })
}
