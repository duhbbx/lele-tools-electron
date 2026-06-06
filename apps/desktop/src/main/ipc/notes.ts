import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, dialog, ipcMain, net, protocol, shell } from 'electron'
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
  let destName = srcName
  if (existsSync(join(dir, destName))) destName = `${Date.now()}-${destName}`
  const dest = join(dir, destName)
  write(dest)
  const size = statSync(dest).size
  const storedPath = relative(app.getPath('userData'), dest)
  const id = s().files.add(noteId, { name: destName, storedPath, mime, size })
  return s().files.get(id)
}

/** 必须在 app ready 之前调用：让 notes-file:// 可被 <img>/<audio>/<video>/fetch 使用 */
export function registerNotesScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'notes-file', privileges: { secure: true, supportFetchAPI: true, stream: true } },
  ])
}

/** app ready 之后调用：notes-file://<fileId>/<name> → 附件目录里的真实文件 */
export function registerNotesProtocol(): void {
  protocol.handle('notes-file', (request) => {
    const id = Number(new URL(request.url).hostname)
    const row = Number.isInteger(id) ? s().files.get(id) : null
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
  ipcMain.handle('notes:folders:remove', (_e, id: number) => {
    const noteIds = s().folders.collectDescendantNoteIds(id)
    s().folders.remove(id)
    removeNoteDirs(noteIds)
  })

  // notes
  ipcMain.handle('notes:list', () => s().notes.list())
  ipcMain.handle('notes:get', (_e, id: number) => s().notes.get(id))
  ipcMain.handle('notes:create', (_e, folderId: number | null) => s().notes.create(folderId))
  ipcMain.handle('notes:update', (_e, id: number, content: string, title: string) =>
    s().notes.update(id, { title, content }),
  )
  ipcMain.handle('notes:move', (_e, id: number, folderId: number | null) =>
    s().notes.move(id, folderId),
  )
  ipcMain.handle('notes:remove', (_e, id: number) => {
    s().notes.remove(id)
    removeNoteDirs([id])
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
}
