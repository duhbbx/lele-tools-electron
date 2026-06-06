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
    store.clients.update(id, { name: '改名公司', type: 'company', note: 'x', phone: '', email: '', legalPerson: '', legalPersonPhone: '', uscc: '', regAddress: '', establishedDate: '', source: '' })
    expect(store.clients.get(id)?.name).toBe('改名公司')
    store.clients.remove(id)
    expect(store.clients.list()).toHaveLength(0)
  })
})

describe('soft delete', () => {
  it('删除客户后 list/get 不可见，但行还在库里', () => {
    const id = store.clients.create({ name: '某公司', type: 'company', note: '' })
    store.clients.remove(id)
    expect(store.clients.list()).toHaveLength(0)
    expect(store.clients.get(id)).toBeNull()
    const raw = db.prepare('SELECT deleted_at FROM crm_clients WHERE id = ?').get(id) as
      | { deleted_at: number | null }
      | undefined
    expect(raw?.deleted_at).toBeTypeOf('number')
  })

  it('删除客户级联给其下干系人/项目打标；payments/files 数据保留', () => {
    const cid = store.clients.create({ name: 'c', type: 'person', note: '' })
    const pid = store.projects.create(cid, { name: '项目A' })
    const ctid = store.contacts.create(cid, { name: '张总' })
    store.payments.add(pid, { amountCents: 100_00, paidAt: '2026-06-01', method: '', note: '' })
    store.files.add(pid, { name: '合同.pdf', storedPath: 'crm-files/1/合同.pdf', size: 10 })
    store.clients.remove(cid)
    expect(store.contacts.listByClient(cid)).toHaveLength(0)
    expect(store.contacts.get(ctid)).toBeNull()
    expect(store.projects.listByClient(cid)).toHaveLength(0)
    expect(store.projects.get(pid)).toBeNull()
    // 项目入口已隐藏，子表数据保留在库里即可
    expect(store.payments.listByProject(pid)).toHaveLength(1)
    expect(store.files.listByProject(pid)).toHaveLength(1)
  })

  it('单删干系人/项目同样仅隐藏', () => {
    const cid = store.clients.create({ name: 'c', type: 'company', note: '' })
    const ctid = store.contacts.create(cid, { name: '张总' })
    const pid = store.projects.create(cid, { name: 'P' })
    store.contacts.remove(ctid)
    store.projects.remove(pid)
    expect(store.contacts.get(ctid)).toBeNull()
    expect(store.contacts.listByClient(cid)).toHaveLength(0)
    expect(store.projects.get(pid)).toBeNull()
    expect(store.projects.listByClient(cid)).toHaveLength(0)
  })
})

describe('project update + payments math source data', () => {
  it('updates full project fields and lists payments', () => {
    const cid = store.clients.create({ name: 'c', type: 'company', note: '' })
    const pid = store.projects.create(cid, { name: 'P' })
    store.projects.update(pid, {
      name: 'P1', status: 'active', description: 'desc', serverAddr: '1.2.3.4',
      domain: 'p.example.com', adminUrl: 'https://p.example.com/admin', adminUser: 'root',
      adminPass: 'pw', wxAppId: 'wx1', wxAppSecret: 's', wxPayParams: '[{"k":"mchId","v":"123"}]',
      amountCents: 5000_00, shareCents: 1500_00, endDate: '2026-12-31',
      reqCurrent: '做官网', reqAdded: '加小程序', reqFuture: '二期 App',
    })
    const p = store.projects.get(pid)
    expect(p?.amountCents).toBe(5000_00)
    expect(p?.shareCents).toBe(1500_00)
    expect(p?.domain).toBe('p.example.com')
    expect(p?.reqAdded).toBe('加小程序')
    store.payments.add(pid, { amountCents: 1000_00, paidAt: '2026-06-01', method: 'bank', note: '首款' })
    store.payments.add(pid, { amountCents: 2000_00, paidAt: '2026-07-01', method: 'alipay', note: '' })
    const pays = store.payments.listByProject(pid)
    expect(pays.map((x) => x.amountCents)).toEqual([1000_00, 2000_00])
    expect(pays.map((x) => x.method)).toEqual(['bank', 'alipay'])
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

  it('老库（无 deleted_at 列）迁移时走 ALTER 补列', () => {
    const oldDb = new Database(':memory:')
    oldDb.exec(
      'CREATE TABLE crm_clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT \'company\', note TEXT NOT NULL DEFAULT \'\', created_at INTEGER NOT NULL)',
    )
    expect(() => migrate(oldDb)).not.toThrow()
    const cols = oldDb.prepare('PRAGMA table_info(crm_clients)').all() as { name: string }[]
    expect(cols.some((c) => c.name === 'deleted_at')).toBe(true)
    oldDb.close()
  })
})

describe('filtered queries', () => {
  let cidA: number
  let cidB: number
  beforeEach(() => {
    cidA = store.clients.create({ name: '阿里云', type: 'company', note: '' })
    cidB = store.clients.create({ name: '张三', type: 'person', note: '' })
    store.contacts.create(cidA, { name: '王经理' })
    store.contacts.create(cidB, { name: '张三本人' })
    const p1 = store.projects.create(cidA, { name: '官网改版' })
    store.projects.create(cidB, { name: '小程序' })
    store.projects.update(p1, {
      name: '官网改版', status: 'done', description: '', serverAddr: '', domain: '',
      adminUrl: '', adminUser: '', adminPass: '', wxAppId: '', wxAppSecret: '',
      wxPayParams: '[]', amountCents: 8000_00, shareCents: 2000_00, endDate: '2026-09-30',
      reqCurrent: '', reqAdded: '', reqFuture: '',
    })
  })

  it('clients.list 支持名称关键字与类型筛选', () => {
    expect(store.clients.list({ q: '阿里' })).toHaveLength(1)
    expect(store.clients.list({ type: 'person' }).map((c) => c.name)).toEqual(['张三'])
    expect(store.clients.list({ q: '阿里', type: 'person' })).toHaveLength(0)
    expect(store.clients.list()).toHaveLength(2)
  })

  it('contacts.listAll 平铺所有干系人并带客户名，支持关键字与客户筛选', () => {
    const all = store.contacts.listAll()
    expect(all).toHaveLength(2)
    expect(all.find((c) => c.name === '王经理')?.clientName).toBe('阿里云')
    expect(store.contacts.listAll({ q: '王' })).toHaveLength(1)
    expect(store.contacts.listAll({ clientId: cidB }).map((c) => c.name)).toEqual(['张三本人'])
  })

  it('projects.listAll 平铺所有项目并带客户名/金额/截止日期，支持状态与客户筛选', () => {
    const all = store.projects.listAll()
    expect(all).toHaveLength(2)
    const p = all.find((x) => x.name === '官网改版')
    expect(p?.clientName).toBe('阿里云')
    expect(p?.amountCents).toBe(8000_00)
    expect(p?.shareCents).toBe(2000_00)
    expect(p?.endDate).toBe('2026-09-30')
    expect(store.projects.listAll({ status: 'done' })).toHaveLength(1)
    expect(store.projects.listAll({ clientId: cidB, q: '小' })).toHaveLength(1)
    expect(store.projects.listAll({ clientId: cidB, status: 'done' })).toHaveLength(0)
  })

  it('软删除的记录不出现在筛选查询里', () => {
    store.clients.remove(cidA)
    expect(store.clients.list()).toHaveLength(1)
    expect(store.contacts.listAll()).toHaveLength(1)
    expect(store.projects.listAll()).toHaveLength(1)
  })

  it('对已软删客户新建的子记录不会从 listAll 泄漏', () => {
    store.clients.remove(cidA)
    store.contacts.create(cidA, { name: '孤儿联系人' })
    store.projects.create(cidA, { name: '孤儿项目' })
    expect(store.contacts.listAll()).toHaveLength(1)
    expect(store.projects.listAll()).toHaveLength(1)
  })
})

describe('extended entity fields', () => {
  it('clients 全字段 create/update 往返', () => {
    const id = store.clients.create({
      name: '某科技公司', type: 'company', email: 'biz@example.com',
      legalPerson: '张法人', legalPersonPhone: '13800000000',
      uscc: '91110000XXXXXXXXXX', regAddress: '北京市朝阳区', establishedDate: '2020-01-01',
      source: 'xiaohongshu',
    })
    const c = store.clients.get(id)
    expect(c?.legalPerson).toBe('张法人')
    expect(c?.uscc).toBe('91110000XXXXXXXXXX')
    expect(c?.email).toBe('biz@example.com')
    expect(c?.phone).toBe('')
    expect(c?.source).toBe('xiaohongshu')
    store.clients.update(id, {
      name: '某科技公司', type: 'person', note: 'n', phone: '13900000000', email: 'p@example.com',
      legalPerson: '张法人', legalPersonPhone: '13800000000',
      uscc: '91110000XXXXXXXXXX', regAddress: '北京市朝阳区', establishedDate: '2020-01-01',
      source: 'referral',
    })
    const c2 = store.clients.get(id)
    expect(c2?.phone).toBe('13900000000')
    expect(c2?.type).toBe('person')
    expect(c2?.source).toBe('referral')
    // 类型切换后公司字段数据保留
    expect(c2?.legalPerson).toBe('张法人')
  })

  it('source 缺省为空串，create 可带来源标记', () => {
    const id1 = store.clients.create({ name: '无来源', type: 'company' })
    expect(store.clients.get(id1)?.source).toBe('')
    const id2 = store.clients.create({ name: '咸鱼客户', type: 'person', source: 'xianyu' })
    expect(store.clients.get(id2)?.source).toBe('xianyu')
  })

  it('contacts 全字段 create 含性别，update 可改性别', () => {
    const cid = store.clients.create({ name: 'c', type: 'person' })
    const id = store.contacts.create(cid, {
      name: '王经理', role: '经理', phone: '13700000000', wechat: 'wx_wang', sex: 'female', email: 'w@x.com',
    })
    const ct = store.contacts.get(id)
    expect(ct?.sex).toBe('female')
    expect(ct?.wechat).toBe('wx_wang')
    expect(ct?.note).toBe('')
    store.contacts.update(id, {
      name: '王经理', role: '经理', phone: '13700000000', wechat: 'wx_wang', email: 'w@x.com', sex: 'male', note: '',
    })
    expect(store.contacts.get(id)?.sex).toBe('male')
  })

  it('projects.create 带基本字段', () => {
    const cid = store.clients.create({ name: 'c', type: 'company' })
    const pid = store.projects.create(cid, {
      name: '官网', status: 'done', description: '改版', amountCents: 8000_00, shareCents: 800_00, endDate: '2026-12-31',
    })
    const p = store.projects.get(pid)
    expect(p?.status).toBe('done')
    expect(p?.amountCents).toBe(8000_00)
    expect(p?.shareCents).toBe(800_00)
    expect(p?.endDate).toBe('2026-12-31')
    expect(p?.description).toBe('改版')
    // 缺省路径
    const pid2 = store.projects.create(cid, { name: 'P2' })
    expect(store.projects.get(pid2)?.status).toBe('active')
    expect(store.projects.get(pid2)?.shareCents).toBe(0)
  })
})

describe('docs + idcard', () => {
  it('docs 增删查 + 名称过滤', () => {
    const id1 = store.docs.add({ name: '合同模板.docx', storedPath: 'crm-files/docs/合同模板.docx', size: 100 })
    store.docs.add({ name: '公司介绍.pdf', storedPath: 'crm-files/docs/公司介绍.pdf', size: 200 })
    expect(store.docs.list()).toHaveLength(2)
    expect(store.docs.list('合同').map((d) => d.id)).toEqual([id1])
    expect(store.docs.get(id1)?.name).toBe('合同模板.docx')
    store.docs.remove(id1)
    expect(store.docs.list()).toHaveLength(1)
  })

  it('身份证正反面路径单独设置/清空，不受整体 update 影响', () => {
    const id = store.clients.create({ name: 'c', type: 'company' })
    store.clients.setIdCard(id, 'front', 'crm-files/clients/1/idcard-front.png')
    expect(store.clients.get(id)?.idCardFront).toBe('crm-files/clients/1/idcard-front.png')
    expect(store.clients.get(id)?.idCardBack).toBe('')
    store.clients.update(id, {
      name: 'c', type: 'company', note: '', phone: '', email: '', legalPerson: '',
      legalPersonPhone: '', uscc: '', regAddress: '', establishedDate: '', source: '',
    })
    expect(store.clients.get(id)?.idCardFront).toBe('crm-files/clients/1/idcard-front.png')
    store.clients.setIdCard(id, 'front', '')
    expect(store.clients.get(id)?.idCardFront).toBe('')
  })
})

describe('extended field columns migration', () => {
  const CLIENT_COLS = [
    'phone', 'email', 'legal_person', 'legal_person_phone', 'uscc', 'reg_address', 'established_date',
  ]

  it('crm_clients 七个新列与 crm_contacts.sex 存在', () => {
    const clientCols = db.prepare('PRAGMA table_info(crm_clients)').all() as { name: string }[]
    for (const c of CLIENT_COLS) {
      expect(clientCols.some((x) => x.name === c), c).toBe(true)
    }
    const contactCols = db.prepare('PRAGMA table_info(crm_contacts)').all() as { name: string }[]
    expect(contactCols.some((x) => x.name === 'sex')).toBe(true)
  })

  it('老库（无新列）迁移时走 ALTER 补齐', () => {
    const oldDb = new Database(':memory:')
    oldDb.exec(
      "CREATE TABLE crm_clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'company', note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)",
    )
    oldDb.exec(
      "CREATE TABLE crm_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', wechat TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)",
    )
    expect(() => migrate(oldDb)).not.toThrow()
    const clientCols = oldDb.prepare('PRAGMA table_info(crm_clients)').all() as { name: string }[]
    for (const c of CLIENT_COLS) {
      expect(clientCols.some((x) => x.name === c), c).toBe(true)
    }
    const contactCols = oldDb.prepare('PRAGMA table_info(crm_contacts)').all() as { name: string }[]
    expect(contactCols.some((x) => x.name === 'sex')).toBe(true)
    oldDb.close()
  })

  it('clients.source / projects.share_cents / payments.method 三个新列存在且老库可补齐', () => {
    expect((db.prepare('PRAGMA table_info(crm_clients)').all() as { name: string }[]).some((x) => x.name === 'source')).toBe(true)
    expect((db.prepare('PRAGMA table_info(crm_projects)').all() as { name: string }[]).some((x) => x.name === 'share_cents')).toBe(true)
    expect((db.prepare('PRAGMA table_info(crm_payments)').all() as { name: string }[]).some((x) => x.name === 'method')).toBe(true)

    const oldDb = new Database(':memory:')
    oldDb.exec(
      'CREATE TABLE crm_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, amount_cents INTEGER NOT NULL, paid_at TEXT NOT NULL DEFAULT \'\', note TEXT NOT NULL DEFAULT \'\')',
    )
    expect(() => migrate(oldDb)).not.toThrow()
    expect((oldDb.prepare('PRAGMA table_info(crm_payments)').all() as { name: string }[]).some((x) => x.name === 'method')).toBe(true)
    oldDb.close()
  })
})
