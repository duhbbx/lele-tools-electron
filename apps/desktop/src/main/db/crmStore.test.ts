import Database from 'better-sqlite3-node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeCrmStore } from './crmStore'
import { migrate } from './schema'

let db: Database.Database
let store: ReturnType<typeof makeCrmStore>

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  store = makeCrmStore(db)
})
afterEach(() => db.close())

describe('crm clients', () => {
  it('creates, lists, updates, deletes clients', () => {
    const id = store.clients.create({ name: '某公司', type: 'company', note: '' })
    expect(store.clients.list()).toHaveLength(1)
    store.clients.update(id, { name: '改名公司', type: 'company', note: 'x' })
    expect(store.clients.get(id)?.name).toBe('改名公司')
    store.clients.remove(id)
    expect(store.clients.list()).toHaveLength(0)
  })
})

describe('cascade + children', () => {
  it('deleting a client cascades contacts/projects/payments/files', () => {
    const cid = store.clients.create({ name: 'c', type: 'person', note: '' })
    const pid = store.projects.create(cid, '项目A')
    store.contacts.create(cid, '张总')
    store.payments.add(pid, { amountCents: 100_00, paidAt: '2026-06-01', note: '' })
    store.files.add(pid, { name: '合同.pdf', storedPath: 'crm-files/1/合同.pdf', size: 10 })
    store.clients.remove(cid)
    expect(store.contacts.listByClient(cid)).toHaveLength(0)
    expect(store.projects.listByClient(cid)).toHaveLength(0)
    expect(store.payments.listByProject(pid)).toHaveLength(0)
    expect(store.files.listByProject(pid)).toHaveLength(0)
  })
})

describe('project update + payments math source data', () => {
  it('updates full project fields and lists payments', () => {
    const cid = store.clients.create({ name: 'c', type: 'company', note: '' })
    const pid = store.projects.create(cid, 'P')
    store.projects.update(pid, {
      name: 'P1', status: 'active', description: 'desc', serverAddr: '1.2.3.4',
      domain: 'p.example.com', adminUrl: 'https://p.example.com/admin', adminUser: 'root',
      adminPass: 'pw', wxAppId: 'wx1', wxAppSecret: 's', wxPayParams: '[{"k":"mchId","v":"123"}]',
      amountCents: 5000_00, endDate: '2026-12-31',
    })
    const p = store.projects.get(pid)
    expect(p?.amountCents).toBe(5000_00)
    expect(p?.domain).toBe('p.example.com')
    store.payments.add(pid, { amountCents: 1000_00, paidAt: '2026-06-01', note: '首款' })
    store.payments.add(pid, { amountCents: 2000_00, paidAt: '2026-07-01', note: '' })
    expect(store.payments.listByProject(pid).map((x) => x.amountCents)).toEqual([1000_00, 2000_00])
  })
})

describe('soft-delete migration', () => {
  it('crm 三表有 deleted_at 列，且二次迁移幂等', () => {
    expect(() => migrate(db)).not.toThrow() // beforeEach 已迁移过一次，这里是第二次
    for (const table of ['crm_clients', 'crm_contacts', 'crm_projects']) {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
      expect(cols.some((c) => c.name === 'deleted_at'), table).toBe(true)
    }
  })
})
