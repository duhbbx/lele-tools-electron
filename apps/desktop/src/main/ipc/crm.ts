import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { app, dialog, ipcMain, shell } from 'electron'
import { makeCrmStore } from '../db/crmStore'
import { getDb } from '../db/sqlite'

let _store: ReturnType<typeof makeCrmStore> | null = null
function s(): ReturnType<typeof makeCrmStore> {
  if (_store === null) _store = makeCrmStore(getDb())
  return _store
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
      },
    ) => s().clients.update(id, c),
  )
  ipcMain.handle('crm:clients:remove', (_e, id: number) => s().clients.remove(id))

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
      p: { name: string; status?: 'active' | 'done'; description?: string; amountCents?: number; endDate?: string },
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
        endDate: string
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
    (_e, projectId: number, p: { amountCents: number; paidAt: string; note: string }) =>
      s().payments.add(projectId, p),
  )
  ipcMain.handle('crm:payments:remove', (_e, id: number) => s().payments.remove(id))

  // files
  ipcMain.handle('crm:files:listByProject', (_e, projectId: number) =>
    s().files.listByProject(projectId),
  )

  ipcMain.handle('crm:files:pick', async (_e, projectId: number) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'] })
    if (result.canceled || result.filePaths.length === 0) return null

    const src = result.filePaths[0]
    const userData = app.getPath('userData')
    const dir = join(userData, 'crm-files', String(projectId))
    mkdirSync(dir, { recursive: true })

    let destName = basename(src)
    const destPath = join(dir, destName)
    if (existsSync(destPath)) {
      destName = `${Date.now()}-${destName}`
    }
    const dest = join(dir, destName)
    copyFileSync(src, dest)

    const size = statSync(dest).size
    const storedPath = relative(userData, dest)
    const newId = s().files.add(projectId, { name: basename(src), storedPath, size })
    return s().files.get(newId)
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
}
