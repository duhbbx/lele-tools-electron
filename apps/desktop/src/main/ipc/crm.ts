import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { basename, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, dialog, ipcMain, net, protocol, shell } from 'electron'
import { type CrmClientSource, type CrmPaymentMethod, makeCrmStore } from '../db/crmStore'
import { getDb } from '../db/sqlite'

let _store: ReturnType<typeof makeCrmStore> | null = null
function s(): ReturnType<typeof makeCrmStore> {
  if (_store === null) _store = makeCrmStore(getDb())
  return _store
}

function crmDir(): string {
  return join(app.getPath('userData'), 'crm-files')
}

/** 把本地文件拷进 crm-files/<sub>/，同名加时间戳前缀；返回 userData 相对路径与大小 */
function copyIntoCrmDir(src: string, sub: string): { storedPath: string; size: number } {
  const dir = join(crmDir(), sub)
  mkdirSync(dir, { recursive: true })
  let destName = basename(src)
  if (existsSync(join(dir, destName))) destName = `${Date.now()}-${destName}`
  const dest = join(dir, destName)
  copyFileSync(src, dest)
  return { storedPath: relative(app.getPath('userData'), dest), size: statSync(dest).size }
}

const IMAGE_FILTER = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]

/** app ready 之后调用：crm-file://idcard/<clientId>/<front|back> → 身份证图片
 *  （scheme 特权声明集中在 ../schemes.ts 的 registerAppSchemes） */
export function registerCrmProtocol(): void {
  protocol.handle('crm-file', (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'idcard') return new Response('not found', { status: 404 })
    const [idStr, side] = url.pathname.split('/').filter(Boolean)
    const id = Number(idStr)
    if (!Number.isInteger(id) || id <= 0 || (side !== 'front' && side !== 'back')) {
      return new Response('bad request', { status: 400 })
    }
    const client = s().clients.get(id)
    const storedPath = side === 'front' ? client?.idCardFront : client?.idCardBack
    if (!storedPath) return new Response('not found', { status: 404 })
    const abs = resolve(app.getPath('userData'), storedPath)
    // 防路径穿越：必须落在 crm-files 内
    if (!abs.startsWith(crmDir() + sep)) return new Response('forbidden', { status: 403 })
    return net.fetch(pathToFileURL(abs).toString())
  })
}

export function registerCrmIpc(): void {
  // clients
  ipcMain.handle('crm:clients:list', (_e, f?: { q?: string; type?: 'company' | 'person' }) =>
    s().clients.list(f),
  )
  ipcMain.handle('crm:clients:get', (_e, id: number) => s().clients.get(id))
  ipcMain.handle(
    'crm:clients:create',
    (
      _e,
      c: {
        name: string; type: 'company' | 'person'; note?: string; phone?: string; email?: string
        legalPerson?: string; legalPersonPhone?: string; uscc?: string; regAddress?: string; establishedDate?: string
        source?: CrmClientSource
      },
    ) => s().clients.create(c),
  )
  ipcMain.handle(
    'crm:clients:update',
    (
      _e,
      id: number,
      c: {
        name: string; type: 'company' | 'person'; note: string; phone: string; email: string
        legalPerson: string; legalPersonPhone: string; uscc: string; regAddress: string; establishedDate: string
        source: CrmClientSource
      },
    ) => s().clients.update(id, c),
  )
  ipcMain.handle('crm:clients:remove', (_e, id: number) => s().clients.remove(id))

  // 法人身份证正/反面：选图 → 拷入 crm-files/clients/<id>/ → 更新列（旧图同步删除）
  ipcMain.handle('crm:clients:pickIdCard', async (_e, id: number, side: 'front' | 'back') => {
    const client = s().clients.get(id)
    if (!client) return null
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: IMAGE_FILTER })
    if (result.canceled || result.filePaths.length === 0) return null
    const src = result.filePaths[0]
    const ext = extname(src).toLowerCase() || '.png'
    // 固定文件名（idcard-front.<ext>），换图直接覆盖语义：先删旧文件再拷
    const old = side === 'front' ? client.idCardFront : client.idCardBack
    if (old) rmSync(join(app.getPath('userData'), old), { force: true })
    const dir = join(crmDir(), 'clients', String(id))
    mkdirSync(dir, { recursive: true })
    const dest = join(dir, `idcard-${side}${ext}`)
    copyFileSync(src, dest)
    const storedPath = relative(app.getPath('userData'), dest)
    s().clients.setIdCard(id, side, storedPath)
    return storedPath
  })

  ipcMain.handle('crm:clients:removeIdCard', (_e, id: number, side: 'front' | 'back') => {
    const client = s().clients.get(id)
    if (!client) return
    const old = side === 'front' ? client.idCardFront : client.idCardBack
    if (old) rmSync(join(app.getPath('userData'), old), { force: true })
    s().clients.setIdCard(id, side, '')
  })

  // contacts
  ipcMain.handle('crm:contacts:listByClient', (_e, clientId: number) =>
    s().contacts.listByClient(clientId),
  )
  ipcMain.handle('crm:contacts:listAll', (_e, f?: { q?: string; clientId?: number }) =>
    s().contacts.listAll(f),
  )
  ipcMain.handle('crm:contacts:get', (_e, id: number) => s().contacts.get(id))
  ipcMain.handle(
    'crm:contacts:create',
    (
      _e,
      clientId: number,
      c: {
        name: string; role?: string; phone?: string; wechat?: string
        email?: string; sex?: '' | 'male' | 'female'; note?: string
      },
    ) => s().contacts.create(clientId, c),
  )
  ipcMain.handle(
    'crm:contacts:update',
    (
      _e,
      id: number,
      c: { name: string; role: string; phone: string; wechat: string; email: string; sex: '' | 'male' | 'female'; note: string },
    ) => s().contacts.update(id, c),
  )
  ipcMain.handle('crm:contacts:remove', (_e, id: number) => s().contacts.remove(id))

  // projects
  ipcMain.handle('crm:projects:listByClient', (_e, clientId: number) =>
    s().projects.listByClient(clientId),
  )
  ipcMain.handle(
    'crm:projects:listAll',
    (_e, f?: { q?: string; status?: 'active' | 'done'; clientId?: number }) =>
      s().projects.listAll(f),
  )
  ipcMain.handle('crm:projects:get', (_e, id: number) => s().projects.get(id))
  ipcMain.handle(
    'crm:projects:create',
    (
      _e,
      clientId: number,
      p: { name: string; status?: 'active' | 'done'; description?: string; amountCents?: number; shareCents?: number; endDate?: string },
    ) => s().projects.create(clientId, p),
  )
  ipcMain.handle(
    'crm:projects:update',
    (
      _e,
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
        shareCents: number
        endDate: string
        reqCurrent: string
        reqAdded: string
        reqFuture: string
      },
    ) => s().projects.update(id, p),
  )
  ipcMain.handle('crm:projects:remove', (_e, id: number) => s().projects.remove(id))

  // payments
  ipcMain.handle('crm:payments:listByProject', (_e, projectId: number) =>
    s().payments.listByProject(projectId),
  )
  ipcMain.handle(
    'crm:payments:add',
    (_e, projectId: number, p: { amountCents: number; paidAt: string; method: CrmPaymentMethod; note: string }) =>
      s().payments.add(projectId, p),
  )
  ipcMain.handle('crm:payments:remove', (_e, id: number) => s().payments.remove(id))

  // files
  ipcMain.handle('crm:files:listByProject', (_e, projectId: number) =>
    s().files.listByProject(projectId),
  )

  // 合同/协议可多选一次性上传
  ipcMain.handle('crm:files:pick', async (_e, projectId: number) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths.map((src) => {
      const { storedPath, size } = copyIntoCrmDir(src, String(projectId))
      const newId = s().files.add(projectId, { name: basename(src), storedPath, size })
      return s().files.get(newId)
    })
  })

  ipcMain.handle('crm:files:open', async (_e, id: number) => {
    const row = s().files.get(id)
    if (!row) return
    const userData = app.getPath('userData')
    await shell.openPath(join(userData, row.storedPath))
  })

  ipcMain.handle('crm:files:remove', (_e, id: number) => {
    const row = s().files.get(id)
    if (row) {
      const userData = app.getPath('userData')
      rmSync(join(userData, row.storedPath), { force: true })
    }
    s().files.remove(id)
  })

  // docs：CRM 文档库（合同模板、公司介绍等）
  ipcMain.handle('crm:docs:list', (_e, q?: string) => s().docs.list(q))

  ipcMain.handle('crm:docs:pick', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths.map((src) => {
      const { storedPath, size } = copyIntoCrmDir(src, 'docs')
      const newId = s().docs.add({ name: basename(src), storedPath, size })
      return s().docs.get(newId)
    })
  })

  ipcMain.handle('crm:docs:open', async (_e, id: number) => {
    const row = s().docs.get(id)
    if (!row) return
    await shell.openPath(join(app.getPath('userData'), row.storedPath))
  })

  ipcMain.handle('crm:docs:remove', (_e, id: number) => {
    const row = s().docs.get(id)
    if (row) rmSync(join(app.getPath('userData'), row.storedPath), { force: true })
    s().docs.remove(id)
  })
}
