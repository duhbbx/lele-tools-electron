# CRM 内嵌 Tab 工作区改造实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把侧边栏的 CRM 树改成单一工具入口，客户/干系人/项目全部在 CRM 工具 tab 内部（左导航 + 内部 tab）完成浏览与编辑；删除改为逻辑删除（deleted_at，仅隐藏）。

**Architecture:** 数据层（schema/crmStore）→ IPC 契约（shared-types/ipc/preload）→ 渲染层（列表/编辑器/CrmPanel）→ 清理旧入口，四层自下而上推进；每个任务独立可编译可测。

**Tech Stack:** Electron 34 / Vue 3.5 / TypeScript / SCSS / better-sqlite3 / vitest

**设计文档:** `docs/superpowers/specs/2026-06-06-crm-tabs-redesign-design.md`

**约定（务必遵守）:**
- git 提交信息：中文 + 约定式前缀，**不带 Co-Authored-By**。
- store 单测 import `better-sqlite3-node`（Node ABI），业务代码 import `better-sqlite3`（Electron ABI），不要混。
- 跑测试：根目录 `pnpm test`（vitest run 全量）或 `pnpm vitest run <文件名关键字>` 过滤。
- 类型检查：根目录 `pnpm typecheck`。
- 样式只用 CSS 变量（--bg/--bg-soft/--bg-hover/--fg/--fg-dim/--border/--accent/--danger），图标用 emoji。

---

## 文件清单

| 操作 | 路径 | 职责 |
|---|---|---|
| 改 | `apps/desktop/src/main/db/schema.ts` | 三表加 `deleted_at INTEGER` 守护式迁移 |
| 改 | `apps/desktop/src/main/db/crmStore.ts` | 软删除 + 带筛选的全量查询 |
| 改 | `apps/desktop/src/main/db/crmStore.test.ts` | 迁移/软删除/筛选测试；更新旧级联测试 |
| 改 | `apps/desktop/src/main/ipc/crm.ts` | `crm:clients:get`、`crm:contacts:listAll`、`crm:projects:listAll`、list 带筛选 |
| 改 | `apps/desktop/src/preload/index.ts` | 对应 bridge 方法 |
| 改 | `packages/shared-types/src/index.ts` | 筛选类型 + 列表行类型 + CrmBridge 扩展 |
| 改 | `packages/ui/src/i18n.ts` | CRM 列表/导航文案键 |
| 建 | `packages/ui/src/components/crm/confirm.ts` | 两步删除确认 composable |
| 建 | `packages/ui/src/components/crm/confirm.test.ts` | composable 测试 |
| 建 | `packages/ui/src/components/crm/crm-list.scss` | 三个列表页共享样式 |
| 建 | `packages/ui/src/components/crm/ClientList.vue` | 客户列表页 |
| 建 | `packages/ui/src/components/crm/ContactList.vue` | 干系人列表页 |
| 建 | `packages/ui/src/components/crm/ProjectList.vue` | 项目列表页 |
| 建 | `packages/ui/src/components/crm/CrmNewForm.vue` | 统一新增表单（三实体） |
| 建 | `packages/ui/src/components/crm/ClientEditor.vue` | 客户详情（基本信息 + 关联列表） |
| 改 | `packages/ui/src/components/crm/ContactEditor.vue` | 加「所属客户」只读展示 |
| 改 | `packages/ui/src/components/crm/ProjectEditor.vue` | 加「所属客户」只读展示 |
| 建 | `packages/ui/src/components/crm/CrmPanel.vue` | CRM 根组件：左导航 + 内部 tab |
| 建 | `packages/ui/src/tools/crm/meta.ts` | 工具注册元数据 |
| 改 | `packages/ui/src/tools/index.ts` | 注册 crm 工具 |
| 改 | `packages/ui/src/Workspace.vue` | 外层 tab 回归纯工具 |
| 改 | `packages/ui/src/components/SideNav.vue` | 移除 CrmTree 嵌入 |
| 删 | `packages/ui/src/components/CrmTree.vue` | 废弃 |

---

### Task 1: schema 加 deleted_at 守护式迁移

**Files:**
- Modify: `apps/desktop/src/main/db/schema.ts`
- Test: `apps/desktop/src/main/db/crmStore.test.ts`

- [ ] **Step 1: 写失败测试**

在 `crmStore.test.ts` 末尾追加：

```ts
describe('soft-delete migration', () => {
  it('crm 三表有 deleted_at 列，且二次迁移幂等', () => {
    expect(() => migrate(db)).not.toThrow() // beforeEach 已迁移过一次，这里是第二次
    for (const table of ['crm_clients', 'crm_contacts', 'crm_projects']) {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
      expect(cols.some((c) => c.name === 'deleted_at'), table).toBe(true)
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run crmStore`
Expected: FAIL —— `deleted_at` 列不存在（`expect(false).toBe(true)`）

- [ ] **Step 3: 实现迁移**

`schema.ts` 两处修改。

(a) 三个 CREATE TABLE 里加列（新库直接带上）。`crm_clients`：

```sql
    CREATE TABLE IF NOT EXISTS crm_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'company',
      note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
```

`crm_contacts` 与 `crm_projects` 同理：在各自最后一个字段后加 `, deleted_at INTEGER`（`crm_contacts` 在 `created_at INTEGER NOT NULL` 后；`crm_projects` 在 `created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL` 后）。

(b) `migrate()` 函数末尾、`db.exec(...)` 之后追加（老库走 ALTER）：

```ts
  // CRM 软删除列：CREATE TABLE IF NOT EXISTS 不会给已存在的老库加列，这里守护式补
  for (const table of ['crm_clients', 'crm_contacts', 'crm_projects']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (!cols.some((c) => c.name === 'deleted_at')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at INTEGER`)
    }
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run crmStore`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/main/db/schema.ts apps/desktop/src/main/db/crmStore.test.ts
git commit -m "feat(crm): crm 三表加 deleted_at 软删除列"
```

---

### Task 2: crmStore 改逻辑删除

**Files:**
- Modify: `apps/desktop/src/main/db/crmStore.ts`
- Test: `apps/desktop/src/main/db/crmStore.test.ts`

- [ ] **Step 1: 写失败测试 + 更新旧级联测试**

`crmStore.test.ts` 中现有 `describe('cascade + children')` 的断言基于物理删除（payments/files 也消失）。**替换整个 describe** 为：

```ts
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
    const pid = store.projects.create(cid, '项目A')
    const ctid = store.contacts.create(cid, '张总')
    store.payments.add(pid, { amountCents: 100_00, paidAt: '2026-06-01', note: '' })
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
    const ctid = store.contacts.create(cid, '张总')
    const pid = store.projects.create(cid, 'P')
    store.contacts.remove(ctid)
    store.projects.remove(pid)
    expect(store.contacts.get(ctid)).toBeNull()
    expect(store.contacts.listByClient(cid)).toHaveLength(0)
    expect(store.projects.get(pid)).toBeNull()
    expect(store.projects.listByClient(cid)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run crmStore`
Expected: FAIL —— remove 仍是物理 DELETE，`deleted_at` 为 null / 子表被级联物理删

- [ ] **Step 3: 实现软删除**

`crmStore.ts` 修改以下方法（其余不动，payments/files 保持物理删除）：

```ts
    clients: {
      list(): CrmClientRow[] {
        const rows = db
          .prepare('SELECT * FROM crm_clients WHERE deleted_at IS NULL ORDER BY name')
          .all() as Record<string, unknown>[]
        return rows.map(mapClient)
      },
      get(id: number): CrmClientRow | null {
        const row = db
          .prepare('SELECT * FROM crm_clients WHERE id = ? AND deleted_at IS NULL')
          .get(id) as Record<string, unknown> | undefined
        return row ? mapClient(row) : null
      },
      // create / update 不变
      remove(id: number): void {
        const now = Date.now()
        db.transaction(() => {
          db.prepare('UPDATE crm_clients SET deleted_at = ? WHERE id = ?').run(now, id)
          db.prepare(
            'UPDATE crm_contacts SET deleted_at = ? WHERE client_id = ? AND deleted_at IS NULL',
          ).run(now, id)
          db.prepare(
            'UPDATE crm_projects SET deleted_at = ? WHERE client_id = ? AND deleted_at IS NULL',
          ).run(now, id)
        })()
      },
    },
```

contacts（list/get 过滤 + remove 改 UPDATE）：

```ts
      listByClient(clientId: number): CrmContactRow[] {
        const rows = db
          .prepare(
            'SELECT * FROM crm_contacts WHERE client_id = ? AND deleted_at IS NULL ORDER BY name',
          )
          .all(clientId) as Record<string, unknown>[]
        return rows.map(mapContact)
      },
      get(id: number): CrmContactRow | null {
        const row = db
          .prepare('SELECT * FROM crm_contacts WHERE id = ? AND deleted_at IS NULL')
          .get(id) as Record<string, unknown> | undefined
        return row ? mapContact(row) : null
      },
      // create / update 不变
      remove(id: number): void {
        db.prepare('UPDATE crm_contacts SET deleted_at = ? WHERE id = ?').run(Date.now(), id)
      },
```

projects 同 contacts 模式：

```ts
      listByClient(clientId: number): { id: number; name: string; status: string }[] {
        const rows = db
          .prepare(
            'SELECT id, name, status FROM crm_projects WHERE client_id = ? AND deleted_at IS NULL ORDER BY name',
          )
          .all(clientId) as { id: number; name: string; status: string }[]
        return rows
      },
      get(id: number): CrmProjectRow | null {
        const row = db
          .prepare('SELECT * FROM crm_projects WHERE id = ? AND deleted_at IS NULL')
          .get(id) as Record<string, unknown> | undefined
        return row ? mapProject(row) : null
      },
      // create / update 不变
      remove(id: number): void {
        db.prepare('UPDATE crm_projects SET deleted_at = ? WHERE id = ?').run(Date.now(), id)
      },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run crmStore`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/main/db/crmStore.ts apps/desktop/src/main/db/crmStore.test.ts
git commit -m "feat(crm): store 改逻辑删除，删客户事务级联打标"
```

---

### Task 3: crmStore 带筛选的全量查询

**Files:**
- Modify: `apps/desktop/src/main/db/crmStore.ts`
- Test: `apps/desktop/src/main/db/crmStore.test.ts`

- [ ] **Step 1: 写失败测试**

`crmStore.test.ts` 末尾追加：

```ts
describe('filtered queries', () => {
  let cidA: number
  let cidB: number
  beforeEach(() => {
    cidA = store.clients.create({ name: '阿里云', type: 'company', note: '' })
    cidB = store.clients.create({ name: '张三', type: 'person', note: '' })
    store.contacts.create(cidA, '王经理')
    store.contacts.create(cidB, '张三本人')
    const p1 = store.projects.create(cidA, '官网改版')
    store.projects.create(cidB, '小程序')
    store.projects.update(p1, {
      name: '官网改版', status: 'done', description: '', serverAddr: '', domain: '',
      adminUrl: '', adminUser: '', adminPass: '', wxAppId: '', wxAppSecret: '',
      wxPayParams: '[]', amountCents: 8000_00, endDate: '2026-09-30',
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
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run crmStore`
Expected: FAIL —— `listAll` 不存在 / `list` 不接受参数

- [ ] **Step 3: 实现**

`crmStore.ts` 顶部接口区追加：

```ts
export interface CrmProjectListRow {
  id: number
  clientId: number
  name: string
  status: 'active' | 'done'
  clientName: string
  amountCents: number
  endDate: string
}
```

`clients.list` 改为：

```ts
      list(f?: { q?: string; type?: 'company' | 'person' }): CrmClientRow[] {
        const conds = ['deleted_at IS NULL']
        const params: unknown[] = []
        if (f?.q) {
          conds.push('name LIKE ?')
          params.push(`%${f.q}%`)
        }
        if (f?.type) {
          conds.push('type = ?')
          params.push(f.type)
        }
        const rows = db
          .prepare(`SELECT * FROM crm_clients WHERE ${conds.join(' AND ')} ORDER BY name`)
          .all(...params) as Record<string, unknown>[]
        return rows.map(mapClient)
      },
```

`contacts` 对象里、`listByClient` 之后追加：

```ts
      listAll(f?: { q?: string; clientId?: number }): (CrmContactRow & { clientName: string })[] {
        const conds = ['c.deleted_at IS NULL']
        const params: unknown[] = []
        if (f?.q) {
          conds.push('c.name LIKE ?')
          params.push(`%${f.q}%`)
        }
        if (f?.clientId) {
          conds.push('c.client_id = ?')
          params.push(f.clientId)
        }
        const rows = db
          .prepare(
            `SELECT c.*, cl.name AS client_name FROM crm_contacts c
             JOIN crm_clients cl ON cl.id = c.client_id
             WHERE ${conds.join(' AND ')} ORDER BY c.name`,
          )
          .all(...params) as Record<string, unknown>[]
        return rows.map((r) => ({ ...mapContact(r), clientName: r.client_name as string }))
      },
```

`projects` 对象里、`listByClient` 之后追加：

```ts
      listAll(f?: {
        q?: string
        status?: 'active' | 'done'
        clientId?: number
      }): CrmProjectListRow[] {
        const conds = ['p.deleted_at IS NULL']
        const params: unknown[] = []
        if (f?.q) {
          conds.push('p.name LIKE ?')
          params.push(`%${f.q}%`)
        }
        if (f?.status) {
          conds.push('p.status = ?')
          params.push(f.status)
        }
        if (f?.clientId) {
          conds.push('p.client_id = ?')
          params.push(f.clientId)
        }
        const rows = db
          .prepare(
            `SELECT p.id, p.client_id, p.name, p.status, p.amount_cents, p.end_date,
                    cl.name AS client_name
             FROM crm_projects p
             JOIN crm_clients cl ON cl.id = p.client_id
             WHERE ${conds.join(' AND ')} ORDER BY p.name`,
          )
          .all(...params) as Record<string, unknown>[]
        return rows.map((r) => ({
          id: r.id as number,
          clientId: r.client_id as number,
          name: r.name as string,
          status: r.status as 'active' | 'done',
          clientName: r.client_name as string,
          amountCents: r.amount_cents as number,
          endDate: r.end_date as string,
        }))
      },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run crmStore`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/main/db/crmStore.ts apps/desktop/src/main/db/crmStore.test.ts
git commit -m "feat(crm): store 全量平铺筛选查询（关键字/类型/状态/客户）"
```

---

### Task 4: shared-types + IPC + preload 契约打通

**Files:**
- Modify: `packages/shared-types/src/index.ts:97-130`
- Modify: `apps/desktop/src/main/ipc/crm.ts`
- Modify: `apps/desktop/src/preload/index.ts:95-163`

- [ ] **Step 1: shared-types 扩展**

在 `CrmFile` 接口（约 95 行）之后、`CrmBridge` 之前插入：

```ts
export interface CrmClientFilter { q?: string; type?: 'company' | 'person' }
export interface CrmContactFilter { q?: string; clientId?: number }
export interface CrmProjectFilter { q?: string; status?: 'active' | 'done'; clientId?: number }
export interface CrmContactWithClient extends CrmContact { clientName: string }
export interface CrmProjectListItem {
  id: number; clientId: number; name: string; status: 'active' | 'done'
  clientName: string; amountCents: number; endDate: string
}
```

`CrmBridge` 内修改/追加（其余成员不动）：

```ts
  clients: {
    list(f?: CrmClientFilter): Promise<CrmClient[]>
    get(id: number): Promise<CrmClient | null>
    create(name: string, type: 'company' | 'person'): Promise<number>
    update(id: number, c: { name: string; type: 'company' | 'person'; note: string }): Promise<void>
    remove(id: number): Promise<void>
  }
  contacts: {
    listByClient(clientId: number): Promise<CrmContact[]>
    listAll(f?: CrmContactFilter): Promise<CrmContactWithClient[]>
    get(id: number): Promise<CrmContact | null>
    create(clientId: number, name: string): Promise<number>
    update(id: number, c: Omit<CrmContact, 'id' | 'clientId' | 'createdAt'>): Promise<void>
    remove(id: number): Promise<void>
  }
  projects: {
    listByClient(clientId: number): Promise<CrmProjectLite[]>
    listAll(f?: CrmProjectFilter): Promise<CrmProjectListItem[]>
    get(id: number): Promise<CrmProject | null>
    create(clientId: number, name: string): Promise<number>
    update(id: number, p: Omit<CrmProject, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>): Promise<void>
    remove(id: number): Promise<void>
  }
```

- [ ] **Step 2: IPC handler**

`apps/desktop/src/main/ipc/crm.ts`：

`crm:clients:list` 改为带筛选，并在其后加 `crm:clients:get`：

```ts
  ipcMain.handle('crm:clients:list', (_e, f?: { q?: string; type?: 'company' | 'person' }) =>
    s().clients.list(f),
  )
  ipcMain.handle('crm:clients:get', (_e, id: number) => s().clients.get(id))
```

`crm:contacts:listByClient` 之后加：

```ts
  ipcMain.handle('crm:contacts:listAll', (_e, f?: { q?: string; clientId?: number }) =>
    s().contacts.listAll(f),
  )
```

`crm:projects:listByClient` 之后加：

```ts
  ipcMain.handle(
    'crm:projects:listAll',
    (_e, f?: { q?: string; status?: 'active' | 'done'; clientId?: number }) =>
      s().projects.listAll(f),
  )
```

- [ ] **Step 3: preload**

`apps/desktop/src/preload/index.ts` 的 `crm` 段：

```ts
    clients: {
      list: (f?: { q?: string; type?: 'company' | 'person' }) =>
        ipcRenderer.invoke('crm:clients:list', f),
      get: (id: number) => ipcRenderer.invoke('crm:clients:get', id),
      // create / update / remove 不变
```

contacts 段 `listByClient` 后加：

```ts
      listAll: (f?: { q?: string; clientId?: number }) =>
        ipcRenderer.invoke('crm:contacts:listAll', f),
```

projects 段 `listByClient` 后加：

```ts
      listAll: (f?: { q?: string; status?: 'active' | 'done'; clientId?: number }) =>
        ipcRenderer.invoke('crm:projects:listAll', f),
```

- [ ] **Step 4: 验证**

Run: `pnpm typecheck`
Expected: 0 error（preload 实现与 CrmBridge 接口对齐）

- [ ] **Step 5: 提交**

```bash
git add packages/shared-types/src/index.ts apps/desktop/src/main/ipc/crm.ts apps/desktop/src/preload/index.ts
git commit -m "feat(crm): IPC 契约补软删筛选查询与 clients.get"
```

---

### Task 5: i18n 键 + 两步删除确认 composable

**Files:**
- Modify: `packages/ui/src/i18n.ts:46-52`
- Create: `packages/ui/src/components/crm/confirm.ts`
- Test: `packages/ui/src/components/crm/confirm.test.ts`

- [ ] **Step 1: i18n 追加键**

在 `'crm.confirmDelete'` 行之后追加（保留现有 crm.* 键，`crm.addClient` 此时先不删，CrmTree 还在用）：

```ts
  'crm.clients': { zh: '客户', en: 'Clients' },
  'crm.add': { zh: '新增', en: 'Add' },
  'crm.searchName': { zh: '搜索名称…', en: 'Search name…' },
  'crm.all': { zh: '全部', en: 'All' },
  'crm.statusActive': { zh: '进行中', en: 'Active' },
  'crm.statusDone': { zh: '已完结', en: 'Done' },
  'crm.client': { zh: '所属客户', en: 'Client' },
  'crm.actions': { zh: '操作', en: 'Actions' },
  'crm.detail': { zh: '详情', en: 'Detail' },
  'crm.delete': { zh: '删除', en: 'Delete' },
  'crm.name': { zh: '名称', en: 'Name' },
  'crm.type': { zh: '类型', en: 'Type' },
  'crm.note': { zh: '备注', en: 'Note' },
  'crm.createdAt': { zh: '创建时间', en: 'Created' },
  'crm.status': { zh: '状态', en: 'Status' },
  'crm.amount': { zh: '金额', en: 'Amount' },
  'crm.endDate': { zh: '截止日期', en: 'End date' },
  'crm.role': { zh: '职位', en: 'Role' },
  'crm.phone': { zh: '电话', en: 'Phone' },
  'crm.wechat': { zh: '微信', en: 'WeChat' },
  'crm.email': { zh: '邮箱', en: 'Email' },
  'crm.empty': { zh: '暂无数据', en: 'No data' },
  'crm.hint': { zh: '从左侧选择 客户 / 干系人 / 项目', en: 'Pick Clients / Contacts / Projects on the left' },
```

- [ ] **Step 2: 写 composable 失败测试**

Create `packages/ui/src/components/crm/confirm.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConfirmDelete } from './confirm'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useConfirmDelete', () => {
  it('第一次点进入确认态，3s 内再点执行', () => {
    const executed: number[] = []
    const { confirmingId, trigger } = useConfirmDelete((id) => {
      executed.push(id)
    })
    trigger(1)
    expect(confirmingId.value).toBe(1)
    expect(executed).toEqual([])
    trigger(1)
    expect(executed).toEqual([1])
    expect(confirmingId.value).toBeNull()
  })

  it('3s 超时自动复位，不执行', () => {
    const executed: number[] = []
    const { confirmingId, trigger } = useConfirmDelete((id) => {
      executed.push(id)
    })
    trigger(1)
    vi.advanceTimersByTime(3001)
    expect(confirmingId.value).toBeNull()
    trigger(1) // 重新进入确认态而不是执行
    expect(executed).toEqual([])
  })

  it('换一行点删除会切换确认目标', () => {
    const executed: number[] = []
    const { confirmingId, trigger } = useConfirmDelete((id) => {
      executed.push(id)
    })
    trigger(1)
    trigger(2)
    expect(confirmingId.value).toBe(2)
    expect(executed).toEqual([])
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm vitest run confirm`
Expected: FAIL —— 模块不存在

- [ ] **Step 4: 实现 composable**

Create `packages/ui/src/components/crm/confirm.ts`:

```ts
import { ref } from 'vue'

/** 两步删除确认（同 CRM 编辑器既有模式）：第一次点击进入确认态，3s 内再点执行，超时自动复位。 */
export function useConfirmDelete(execute: (id: number) => void | Promise<void>) {
  const confirmingId = ref<number | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  function reset(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    confirmingId.value = null
  }

  function trigger(id: number): void {
    if (confirmingId.value === id) {
      reset()
      void execute(id)
      return
    }
    if (timer !== null) clearTimeout(timer)
    confirmingId.value = id
    timer = setTimeout(reset, 3000)
  }

  return { confirmingId, trigger }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run confirm`
Expected: 3 个用例 PASS

- [ ] **Step 6: 提交**

```bash
git add packages/ui/src/i18n.ts packages/ui/src/components/crm/confirm.ts packages/ui/src/components/crm/confirm.test.ts
git commit -m "feat(crm): 列表文案 i18n 键与两步删除确认 composable"
```

---

### Task 6: 三个列表页组件

**Files:**
- Create: `packages/ui/src/components/crm/crm-list.scss`
- Create: `packages/ui/src/components/crm/ClientList.vue`
- Create: `packages/ui/src/components/crm/ContactList.vue`
- Create: `packages/ui/src/components/crm/ProjectList.vue`

三个组件结构一致：props `{ refreshTick: number }`，emits `open(id, title)` / `add()` / `deleted(id)`；输入防抖 200ms 即查；删除走 `useConfirmDelete`。

- [ ] **Step 1: 共享样式**

Create `packages/ui/src/components/crm/crm-list.scss`:

```scss
.crm-list {
  display: flex;
  flex-direction: column;
  height: 100%;

  .filter-bar {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);

    .search { width: 180px; }
    select.input { width: auto; }
    .spacer { flex: 1; }
  }

  .table-wrap {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 12px 12px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th {
      position: sticky;
      top: 0;
      background: var(--bg);
      text-align: left;
      color: var(--fg-dim);
      font-weight: 500;
      padding: 8px 6px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }

    td {
      padding: 6px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }

    tbody tr:hover td { background: var(--bg-hover); }

    .ellipsis {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .ops {
    white-space: nowrap;

    .link {
      border: 0;
      background: none;
      color: var(--accent);
      cursor: pointer;
      padding: 2px 6px;
      font-size: 13px;

      &:hover { text-decoration: underline; }

      &.danger { color: var(--danger, #e55); }
      &.danger.confirming { font-weight: 600; }
    }
  }

  .empty {
    padding: 24px;
    text-align: center;
    color: var(--fg-dim);
  }
}
```

- [ ] **Step 2: ClientList.vue**

```vue
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { CrmClient } from '@lele/shared-types'
import { t } from '../../i18n'
import { useConfirmDelete } from './confirm'

const props = defineProps<{ refreshTick: number }>()
const emit = defineEmits<{ open: [id: number, title: string]; add: []; deleted: [id: number] }>()

const q = ref('')
const type = ref<'' | 'company' | 'person'>('')
const rows = ref<CrmClient[]>([])

async function load(): Promise<void> {
  try {
    rows.value =
      (await window.api?.crm?.clients?.list?.({
        q: q.value.trim() || undefined,
        type: type.value || undefined,
      })) ?? []
  } catch (e) {
    console.warn('[ClientList] load error', e)
  }
}

let debounce: ReturnType<typeof setTimeout> | null = null
watch(q, () => {
  if (debounce !== null) clearTimeout(debounce)
  debounce = setTimeout(() => void load(), 200)
})
watch(type, () => void load())
watch(() => props.refreshTick, () => void load())
onMounted(() => void load())

const { confirmingId, trigger } = useConfirmDelete(async (id) => {
  try {
    await window.api?.crm?.clients?.remove?.(id)
    emit('deleted', id)
    await load()
  } catch (e) {
    console.warn('[ClientList] remove error', e)
  }
})

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="crm-list">
    <div class="filter-bar">
      <input v-model="q" class="input search" :placeholder="t('crm.searchName')" />
      <select v-model="type" class="input">
        <option value="">{{ t('crm.all') }}</option>
        <option value="company">{{ t('crm.company') }}</option>
        <option value="person">{{ t('crm.person') }}</option>
      </select>
      <span class="spacer" />
      <button class="btn btn-primary" @click="emit('add')">＋ {{ t('crm.add') }}</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t('crm.name') }}</th>
            <th>{{ t('crm.type') }}</th>
            <th>{{ t('crm.note') }}</th>
            <th>{{ t('crm.createdAt') }}</th>
            <th>{{ t('crm.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ r.name }}</td>
            <td>{{ r.type === 'company' ? t('crm.company') : t('crm.person') }}</td>
            <td class="ellipsis">{{ r.note }}</td>
            <td>{{ fmtDate(r.createdAt) }}</td>
            <td class="ops">
              <button class="link" @click="emit('open', r.id, r.name)">{{ t('crm.detail') }}</button>
              <button
                class="link danger"
                :class="{ confirming: confirmingId === r.id }"
                @click="trigger(r.id)"
              >{{ confirmingId === r.id ? t('crm.confirmDelete') : t('crm.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length" class="empty">{{ t('crm.empty') }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use './crm-list';
</style>
```

- [ ] **Step 3: ContactList.vue**

```vue
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { CrmClient, CrmContactWithClient } from '@lele/shared-types'
import { t } from '../../i18n'
import { useConfirmDelete } from './confirm'

const props = defineProps<{ refreshTick: number }>()
const emit = defineEmits<{ open: [id: number, title: string]; add: []; deleted: [id: number] }>()

const q = ref('')
const clientId = ref(0)
const clients = ref<CrmClient[]>([])
const rows = ref<CrmContactWithClient[]>([])

async function load(): Promise<void> {
  try {
    rows.value =
      (await window.api?.crm?.contacts?.listAll?.({
        q: q.value.trim() || undefined,
        clientId: clientId.value || undefined,
      })) ?? []
  } catch (e) {
    console.warn('[ContactList] load error', e)
  }
}

async function loadClients(): Promise<void> {
  try {
    clients.value = (await window.api?.crm?.clients?.list?.()) ?? []
  } catch (e) {
    console.warn('[ContactList] load clients error', e)
  }
}

let debounce: ReturnType<typeof setTimeout> | null = null
watch(q, () => {
  if (debounce !== null) clearTimeout(debounce)
  debounce = setTimeout(() => void load(), 200)
})
watch(clientId, () => void load())
watch(() => props.refreshTick, () => {
  void load()
  void loadClients()
})
onMounted(() => {
  void load()
  void loadClients()
})

const { confirmingId, trigger } = useConfirmDelete(async (id) => {
  try {
    await window.api?.crm?.contacts?.remove?.(id)
    emit('deleted', id)
    await load()
  } catch (e) {
    console.warn('[ContactList] remove error', e)
  }
})
</script>

<template>
  <div class="crm-list">
    <div class="filter-bar">
      <input v-model="q" class="input search" :placeholder="t('crm.searchName')" />
      <select v-model.number="clientId" class="input">
        <option :value="0">{{ t('crm.all') }}</option>
        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <span class="spacer" />
      <button class="btn btn-primary" @click="emit('add')">＋ {{ t('crm.add') }}</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t('crm.name') }}</th>
            <th>{{ t('crm.client') }}</th>
            <th>{{ t('crm.role') }}</th>
            <th>{{ t('crm.phone') }}</th>
            <th>{{ t('crm.wechat') }}</th>
            <th>{{ t('crm.email') }}</th>
            <th>{{ t('crm.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ r.name }}</td>
            <td>{{ r.clientName }}</td>
            <td>{{ r.role }}</td>
            <td>{{ r.phone }}</td>
            <td>{{ r.wechat }}</td>
            <td class="ellipsis">{{ r.email }}</td>
            <td class="ops">
              <button class="link" @click="emit('open', r.id, r.name)">{{ t('crm.detail') }}</button>
              <button
                class="link danger"
                :class="{ confirming: confirmingId === r.id }"
                @click="trigger(r.id)"
              >{{ confirmingId === r.id ? t('crm.confirmDelete') : t('crm.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length" class="empty">{{ t('crm.empty') }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use './crm-list';
</style>
```

- [ ] **Step 4: ProjectList.vue**

```vue
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { CrmClient, CrmProjectListItem } from '@lele/shared-types'
import { t } from '../../i18n'
import { centsToYuan } from '../../money'
import { useConfirmDelete } from './confirm'

const props = defineProps<{ refreshTick: number }>()
const emit = defineEmits<{ open: [id: number, title: string]; add: []; deleted: [id: number] }>()

const q = ref('')
const status = ref<'' | 'active' | 'done'>('')
const clientId = ref(0)
const clients = ref<CrmClient[]>([])
const rows = ref<CrmProjectListItem[]>([])

async function load(): Promise<void> {
  try {
    rows.value =
      (await window.api?.crm?.projects?.listAll?.({
        q: q.value.trim() || undefined,
        status: status.value || undefined,
        clientId: clientId.value || undefined,
      })) ?? []
  } catch (e) {
    console.warn('[ProjectList] load error', e)
  }
}

async function loadClients(): Promise<void> {
  try {
    clients.value = (await window.api?.crm?.clients?.list?.()) ?? []
  } catch (e) {
    console.warn('[ProjectList] load clients error', e)
  }
}

let debounce: ReturnType<typeof setTimeout> | null = null
watch(q, () => {
  if (debounce !== null) clearTimeout(debounce)
  debounce = setTimeout(() => void load(), 200)
})
watch([status, clientId], () => void load())
watch(() => props.refreshTick, () => {
  void load()
  void loadClients()
})
onMounted(() => {
  void load()
  void loadClients()
})

const { confirmingId, trigger } = useConfirmDelete(async (id) => {
  try {
    await window.api?.crm?.projects?.remove?.(id)
    emit('deleted', id)
    await load()
  } catch (e) {
    console.warn('[ProjectList] remove error', e)
  }
})
</script>

<template>
  <div class="crm-list">
    <div class="filter-bar">
      <input v-model="q" class="input search" :placeholder="t('crm.searchName')" />
      <select v-model="status" class="input">
        <option value="">{{ t('crm.all') }}</option>
        <option value="active">{{ t('crm.statusActive') }}</option>
        <option value="done">{{ t('crm.statusDone') }}</option>
      </select>
      <select v-model.number="clientId" class="input">
        <option :value="0">{{ t('crm.all') }}</option>
        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <span class="spacer" />
      <button class="btn btn-primary" @click="emit('add')">＋ {{ t('crm.add') }}</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t('crm.name') }}</th>
            <th>{{ t('crm.client') }}</th>
            <th>{{ t('crm.status') }}</th>
            <th>{{ t('crm.amount') }}</th>
            <th>{{ t('crm.endDate') }}</th>
            <th>{{ t('crm.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ r.name }}</td>
            <td>{{ r.clientName }}</td>
            <td>{{ r.status === 'active' ? t('crm.statusActive') : t('crm.statusDone') }}</td>
            <td>¥{{ centsToYuan(r.amountCents) }}</td>
            <td>{{ r.endDate }}</td>
            <td class="ops">
              <button class="link" @click="emit('open', r.id, r.name)">{{ t('crm.detail') }}</button>
              <button
                class="link danger"
                :class="{ confirming: confirmingId === r.id }"
                @click="trigger(r.id)"
              >{{ confirmingId === r.id ? t('crm.confirmDelete') : t('crm.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length" class="empty">{{ t('crm.empty') }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use './crm-list';
</style>
```

- [ ] **Step 5: 验证 + 提交**

Run: `pnpm typecheck`
Expected: 0 error

```bash
git add packages/ui/src/components/crm/crm-list.scss packages/ui/src/components/crm/ClientList.vue packages/ui/src/components/crm/ContactList.vue packages/ui/src/components/crm/ProjectList.vue
git commit -m "feat(crm): 客户/干系人/项目列表页（查询条件+新增+操作列）"
```

---

### Task 7: CrmNewForm + 编辑器「所属客户」展示

**Files:**
- Create: `packages/ui/src/components/crm/CrmNewForm.vue`
- Modify: `packages/ui/src/components/crm/ContactEditor.vue`
- Modify: `packages/ui/src/components/crm/ProjectEditor.vue`

- [ ] **Step 1: CrmNewForm.vue**

统一新增表单：客户填名称+类型；干系人/项目填名称+所属客户（可预填）。创建成功 emit `created`，由 CrmPanel 把 tab 变身详情。

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { CrmClient } from '@lele/shared-types'
import { t } from '../../i18n'

const props = defineProps<{ entity: 'client' | 'contact' | 'project'; presetClientId?: number }>()
const emit = defineEmits<{ created: [id: number, title: string] }>()

const name = ref('')
const type = ref<'company' | 'person'>('company')
const clientId = ref<number>(props.presetClientId ?? 0)
const clients = ref<CrmClient[]>([])
const busy = ref(false)

const needClient = computed(() => props.entity !== 'client')
const canSave = computed(() => name.value.trim() !== '' && (!needClient.value || clientId.value > 0))

const HEADING: Record<typeof props.entity, string> = {
  client: '新建客户',
  contact: '新建干系人',
  project: '新建项目',
}

onMounted(async () => {
  if (!needClient.value) return
  try {
    clients.value = (await window.api?.crm?.clients?.list?.()) ?? []
  } catch (e) {
    console.warn('[CrmNewForm] load clients error', e)
  }
})

async function save(): Promise<void> {
  if (!canSave.value || busy.value) return
  busy.value = true
  try {
    const n = name.value.trim()
    let id: number | undefined
    if (props.entity === 'client') {
      id = await window.api?.crm?.clients?.create?.(n, type.value)
    } else if (props.entity === 'contact') {
      id = await window.api?.crm?.contacts?.create?.(clientId.value, n)
    } else {
      id = await window.api?.crm?.projects?.create?.(clientId.value, n)
    }
    if (id != null) emit('created', id, n)
  } catch (e) {
    console.warn('[CrmNewForm] create error', e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="tool-page crm-new-form">
    <h4 class="heading">{{ HEADING[entity] }}</h4>
    <label class="field">
      <span>{{ t('crm.name') }}</span>
      <input v-model="name" class="input" type="text" @keydown.enter="save" />
    </label>
    <label v-if="entity === 'client'" class="field">
      <span>{{ t('crm.type') }}</span>
      <select v-model="type" class="input">
        <option value="company">{{ t('crm.company') }}</option>
        <option value="person">{{ t('crm.person') }}</option>
      </select>
    </label>
    <label v-if="needClient" class="field">
      <span>{{ t('crm.client') }}</span>
      <select v-model.number="clientId" class="input">
        <option :value="0" disabled>—</option>
        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>
    <div class="actions">
      <button class="btn btn-primary" :disabled="!canSave || busy" @click="save">保存</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.crm-new-form {
  max-width: 480px;

  .heading {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 12px;

    > span {
      color: var(--fg-dim);
      width: 5em;
      flex-shrink: 0;
    }

    .input { flex: 1; min-width: 0; }
  }

  .actions { padding-left: calc(5em + 12px); }
}
</style>
```

- [ ] **Step 2: ContactEditor 加「所属客户」只读展示**

`ContactEditor.vue` script 部分：

(a) `const dirty = ref(false)` 之前加一行：

```ts
const clientName = ref('')
```

(b) `onMounted` 内 `fillForm(contact)` 之后追加：

```ts
    const client = (await window.api?.crm?.clients?.get?.(contact.clientId)) ?? null
    clientName.value = client?.name ?? ''
```

template 部分：在「姓名」field 之前插入：

```html
    <label class="field">
      <span>客户</span>
      <span class="readonly-text">{{ clientName }}</span>
    </label>
```

style 部分：`.field` 块内追加：

```scss
    .readonly-text {
      flex: 1;
      color: var(--fg-dim);
    }
```

- [ ] **Step 3: ProjectEditor 加「所属客户」只读展示**

`ProjectEditor.vue` script 部分：

(a) `const dirty = ref(false)` 之前加一行：

```ts
const clientName = ref('')
```

(b) `onMounted` 内 `fillForm(project)` 之后（`await loadPayments()` 之前）追加：

```ts
    const client = (await window.api?.crm?.clients?.get?.(project.clientId)) ?? null
    clientName.value = client?.name ?? ''
```

template 部分：在「名称」field 之前（`<!-- Section 1: 基本信息 -->` 的 `<h4>` 之后）插入：

```html
    <label class="field">
      <span>所属客户</span>
      <span class="readonly-text">{{ clientName }}</span>
    </label>
```

style 部分：`.field` 块内追加：

```scss
    .readonly-text {
      flex: 1;
      color: var(--fg-dim);
    }
```

- [ ] **Step 4: 验证 + 提交**

Run: `pnpm typecheck`
Expected: 0 error

```bash
git add packages/ui/src/components/crm/CrmNewForm.vue packages/ui/src/components/crm/ContactEditor.vue packages/ui/src/components/crm/ProjectEditor.vue
git commit -m "feat(crm): 统一新增表单，编辑器展示所属客户"
```

---

### Task 8: ClientEditor（客户详情 + 关联列表）

**Files:**
- Create: `packages/ui/src/components/crm/ClientEditor.vue`

- [ ] **Step 1: 写组件**

上半部分基本信息（dirty + 保存 + 两步删除，沿用 ContactEditor 模式）；下半部分该客户的干系人/项目关联表格，行点「详情」、区块头「新增」均 emit 给 CrmPanel。

```vue
<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import type { CrmContact, CrmProjectLite } from '@lele/shared-types'
import { t } from '../../i18n'

const props = defineProps<{ refId: number; refreshTick: number }>()
const emit = defineEmits<{
  rename: [title: string]
  removed: []
  openContact: [id: number, title: string]
  openProject: [id: number, title: string]
  addContact: []
  addProject: []
}>()

const form = reactive({ name: '', type: 'company' as 'company' | 'person', note: '' })
const dirty = ref(false)
const busy = ref(false)

const contacts = ref<CrmContact[]>([])
const projects = ref<CrmProjectLite[]>([])

// ── delete confirm（同 ContactEditor 模式）──────────────────────────────────────
const deleteConfirming = ref(false)
let deleteTimer: ReturnType<typeof setTimeout> | null = null

function startDelete(): void {
  if (deleteConfirming.value) {
    void executeDelete()
    return
  }
  deleteConfirming.value = true
  deleteTimer = setTimeout(() => {
    deleteConfirming.value = false
    deleteTimer = null
  }, 3000)
}

async function executeDelete(): Promise<void> {
  if (deleteTimer !== null) {
    clearTimeout(deleteTimer)
    deleteTimer = null
  }
  deleteConfirming.value = false
  busy.value = true
  try {
    await window.api?.crm?.clients?.remove?.(props.refId)
    emit('removed')
  } catch (e) {
    console.warn('[ClientEditor] remove error', e)
  } finally {
    busy.value = false
  }
}

// ── load ───────────────────────────────────────────────────────────────────────
async function loadRelated(): Promise<void> {
  try {
    contacts.value = (await window.api?.crm?.contacts?.listByClient?.(props.refId)) ?? []
    projects.value = (await window.api?.crm?.projects?.listByClient?.(props.refId)) ?? []
  } catch (e) {
    console.warn('[ClientEditor] load related error', e)
  }
}

onMounted(async () => {
  try {
    const client = (await window.api?.crm?.clients?.get?.(props.refId)) ?? null
    if (!client) {
      emit('removed')
      return
    }
    form.name = client.name
    form.type = client.type
    form.note = client.note
    dirty.value = false
    await loadRelated()
  } catch (e) {
    console.warn('[ClientEditor] load error', e)
    emit('removed')
  }
})

watch(() => props.refreshTick, () => void loadRelated())

// ── save ───────────────────────────────────────────────────────────────────────
async function save(): Promise<void> {
  if (!dirty.value || busy.value) return
  busy.value = true
  try {
    await window.api?.crm?.clients?.update?.(props.refId, {
      name: form.name,
      type: form.type,
      note: form.note,
    })
    dirty.value = false
    emit('rename', form.name)
  } catch (e) {
    console.warn('[ClientEditor] save error', e)
  } finally {
    busy.value = false
  }
}

function markDirty(): void {
  dirty.value = true
}
</script>

<template>
  <div class="tool-page client-editor">
    <!-- Sticky top bar -->
    <div class="top-bar">
      <span class="client-heading">{{ form.name || '客户' }}</span>
      <button class="btn btn-primary" :disabled="!dirty || busy" @click="save">保存</button>
      <button
        class="btn btn-danger"
        :class="{ confirming: deleteConfirming }"
        :disabled="busy"
        @click="startDelete"
      >{{ deleteConfirming ? '确认删除?' : '删除客户' }}</button>
    </div>

    <!-- 基本信息 -->
    <label class="field">
      <span>{{ t('crm.name') }}</span>
      <input v-model="form.name" class="input" type="text" @input="markDirty" />
    </label>
    <label class="field">
      <span>{{ t('crm.type') }}</span>
      <select v-model="form.type" class="input" @change="markDirty">
        <option value="company">{{ t('crm.company') }}</option>
        <option value="person">{{ t('crm.person') }}</option>
      </select>
    </label>
    <label class="field field-textarea">
      <span>{{ t('crm.note') }}</span>
      <textarea v-model="form.note" class="input" rows="3" @input="markDirty" />
    </label>

    <!-- 关联：干系人 -->
    <div class="section-head">
      <h4 class="section-title">{{ t('crm.contacts') }}</h4>
      <button class="btn btn-sm" @click="emit('addContact')">＋ {{ t('crm.add') }}</button>
    </div>
    <table v-if="contacts.length" class="related-table">
      <tbody>
        <tr v-for="c in contacts" :key="c.id">
          <td>{{ c.name }}</td>
          <td class="dim">{{ c.role }}</td>
          <td class="dim">{{ c.phone }}</td>
          <td class="ops">
            <button class="link" @click="emit('openContact', c.id, c.name)">{{ t('crm.detail') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty-hint">{{ t('crm.empty') }}</p>

    <!-- 关联：项目 -->
    <div class="section-head">
      <h4 class="section-title">{{ t('crm.projects') }}</h4>
      <button class="btn btn-sm" @click="emit('addProject')">＋ {{ t('crm.add') }}</button>
    </div>
    <table v-if="projects.length" class="related-table">
      <tbody>
        <tr v-for="p in projects" :key="p.id">
          <td>{{ p.name }}</td>
          <td class="dim">{{ p.status === 'active' ? t('crm.statusActive') : t('crm.statusDone') }}</td>
          <td class="ops">
            <button class="link" @click="emit('openProject', p.id, p.name)">{{ t('crm.detail') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty-hint">{{ t('crm.empty') }}</p>
  </div>
</template>

<style scoped lang="scss">
.client-editor {
  .top-bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0 10px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    margin-bottom: 4px;

    .client-heading {
      flex: 1;
      font-size: 15px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;

    > span {
      color: var(--fg-dim);
      width: 3em;
      flex-shrink: 0;
    }

    .input { flex: 1; min-width: 0; }

    &.field-textarea {
      align-items: flex-start;

      > span { padding-top: 4px; }
    }
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;

    .section-title {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--fg-dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }

  .related-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    td {
      padding: 5px 6px;
      border-bottom: 1px solid var(--border);
    }

    .dim { color: var(--fg-dim); }

    .ops {
      text-align: right;
      white-space: nowrap;

      .link {
        border: 0;
        background: none;
        color: var(--accent);
        cursor: pointer;
        font-size: 13px;

        &:hover { text-decoration: underline; }
      }
    }
  }

  .empty-hint {
    font-size: 12px;
    color: var(--fg-dim);
    margin: 6px 0;
  }

  .btn-sm {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 3px;
    border: 1px solid var(--border);
    cursor: pointer;
    background: none;

    &:hover:not(:disabled) { background: var(--bg-hover); }
  }

  .btn-danger {
    border: 1px solid #e55;
    color: #e55;
    background: transparent;
    border-radius: 4px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.15s;

    &:hover:not(:disabled) { background: color-mix(in srgb, #e55 12%, transparent); }

    &.confirming {
      background: color-mix(in srgb, #e55 18%, transparent);
      font-weight: 600;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}
</style>
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm typecheck`
Expected: 0 error

```bash
git add packages/ui/src/components/crm/ClientEditor.vue
git commit -m "feat(crm): 客户详情编辑器（基本信息+关联干系人/项目）"
```

---

### Task 9: CrmPanel + 注册为工具

**Files:**
- Create: `packages/ui/src/components/crm/CrmPanel.vue`
- Create: `packages/ui/src/tools/crm/meta.ts`
- Modify: `packages/ui/src/tools/index.ts`

- [ ] **Step 1: CrmPanel.vue**

左侧迷你导航 + 复用 ToolTabs 的内部 tab 栏 + 内容区。挂载时默认打开「客户」列表。

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { t } from '../../i18n'
import ToolTabs from '../ToolTabs.vue'
import ClientEditor from './ClientEditor.vue'
import ClientList from './ClientList.vue'
import ContactEditor from './ContactEditor.vue'
import ContactList from './ContactList.vue'
import CrmNewForm from './CrmNewForm.vue'
import ProjectEditor from './ProjectEditor.vue'
import ProjectList from './ProjectList.vue'

type Entity = 'client' | 'contact' | 'project'
type CrmTabComp =
  | 'client-list'
  | 'contact-list'
  | 'project-list'
  | 'client'
  | 'contact'
  | 'project'
  | 'new'

interface CrmTab {
  /** list:clients | client:<id> | new:client:<seq> … */
  key: string
  comp: CrmTabComp
  /** 详情 tab 的实体 id */
  refId?: number
  /** new tab 专用 */
  entity?: Entity
  presetClientId?: number
  title: string
  icon: string
}

const tabs = ref<CrmTab[]>([])
const active = ref<string | null>(null)
/** 任何保存/删除/新建后 +1，列表与客户详情关联区块据此刷新 */
const refreshTick = ref(0)
let newSeq = 0

const ENTITY_ICON: Record<Entity, string> = { client: '🏢', contact: '👤', project: '📁' }

const NAV = [
  { key: 'list:clients', comp: 'client-list', icon: '🏢', labelKey: 'crm.clients' },
  { key: 'list:contacts', comp: 'contact-list', icon: '👤', labelKey: 'crm.contacts' },
  { key: 'list:projects', comp: 'project-list', icon: '📁', labelKey: 'crm.projects' },
] as const

onMounted(() => openList(NAV[0]))

function openList(nav: (typeof NAV)[number]): void {
  if (!tabs.value.find((x) => x.key === nav.key)) {
    tabs.value = [...tabs.value, { key: nav.key, comp: nav.comp, title: t(nav.labelKey), icon: nav.icon }]
  }
  active.value = nav.key
}

function openDetail(entity: Entity, id: number, title: string): void {
  const key = `${entity}:${id}`
  const existing = tabs.value.find((x) => x.key === key)
  if (existing) {
    existing.title = title
    active.value = key
    return
  }
  tabs.value = [...tabs.value, { key, comp: entity, refId: id, title, icon: ENTITY_ICON[entity] }]
  active.value = key
}

function openNew(entity: Entity, presetClientId?: number): void {
  newSeq += 1
  const key = `new:${entity}:${newSeq}`
  tabs.value = [
    ...tabs.value,
    { key, comp: 'new', entity, presetClientId, title: t('crm.add'), icon: '＋' },
  ]
  active.value = key
}

/** 新增 tab 保存成功：原地变身详情 tab（key 变化触发重挂载，详情组件自行加载完整数据） */
function onCreated(tab: CrmTab, id: number, title: string): void {
  const entity = tab.entity as Entity
  const detailKey = `${entity}:${id}`
  tab.key = detailKey
  tab.comp = entity
  tab.refId = id
  tab.title = title
  tab.icon = ENTITY_ICON[entity]
  active.value = detailKey
  refreshTick.value++
}

function onRenamed(tab: CrmTab, title: string): void {
  tab.title = title
  refreshTick.value++
}

function onRemoved(tab: CrmTab): void {
  close(tab.key)
  refreshTick.value++
}

/** 列表里删除：把已打开的对应详情 tab 关掉 */
function onListDeleted(entity: Entity, id: number): void {
  close(`${entity}:${id}`)
  refreshTick.value++
}

function close(key: string): void {
  tabs.value = tabs.value.filter((x) => x.key !== key)
  if (active.value === key) active.value = tabs.value[tabs.value.length - 1]?.key ?? null
}

function reorder(fromKey: string, toKey: string): void {
  const arr = [...tabs.value]
  const fromIdx = arr.findIndex((x) => x.key === fromKey)
  const toIdx = arr.findIndex((x) => x.key === toKey)
  if (fromIdx === -1 || toIdx === -1) return
  const [item] = arr.splice(fromIdx, 1)
  arr.splice(toIdx, 0, item!)
  tabs.value = arr
}
</script>

<template>
  <div class="crm-panel">
    <nav class="crm-nav">
      <button
        v-for="n in NAV"
        :key="n.key"
        class="nav-item"
        :class="{ active: active === n.key }"
        @click="openList(n)"
      >
        <span class="icon">{{ n.icon }}</span>{{ t(n.labelKey) }}
      </button>
    </nav>
    <div class="crm-main">
      <ToolTabs
        class="inner-tabs"
        :tabs="tabs.map((x) => ({ key: x.key, title: x.title, icon: x.icon }))"
        :active="active"
        @activate="active = $event"
        @close="close"
        @reorder="reorder"
      />
      <div class="crm-body">
        <div v-if="!tabs.length" class="welcome">{{ t('crm.hint') }}</div>
        <div v-for="tab in tabs" v-show="tab.key === active" :key="tab.key" class="pane">
          <ClientList
            v-if="tab.comp === 'client-list'"
            :refresh-tick="refreshTick"
            @open="(id, title) => openDetail('client', id, title)"
            @add="openNew('client')"
            @deleted="(id) => onListDeleted('client', id)"
          />
          <ContactList
            v-else-if="tab.comp === 'contact-list'"
            :refresh-tick="refreshTick"
            @open="(id, title) => openDetail('contact', id, title)"
            @add="openNew('contact')"
            @deleted="(id) => onListDeleted('contact', id)"
          />
          <ProjectList
            v-else-if="tab.comp === 'project-list'"
            :refresh-tick="refreshTick"
            @open="(id, title) => openDetail('project', id, title)"
            @add="openNew('project')"
            @deleted="(id) => onListDeleted('project', id)"
          />
          <ClientEditor
            v-else-if="tab.comp === 'client'"
            :ref-id="tab.refId!"
            :refresh-tick="refreshTick"
            @rename="(title) => onRenamed(tab, title)"
            @removed="onRemoved(tab)"
            @open-contact="(id, title) => openDetail('contact', id, title)"
            @open-project="(id, title) => openDetail('project', id, title)"
            @add-contact="openNew('contact', tab.refId)"
            @add-project="openNew('project', tab.refId)"
          />
          <ContactEditor
            v-else-if="tab.comp === 'contact'"
            :ref-id="tab.refId!"
            @rename="(title) => onRenamed(tab, title)"
            @removed="onRemoved(tab)"
          />
          <ProjectEditor
            v-else-if="tab.comp === 'project'"
            :ref-id="tab.refId!"
            @rename="(title) => onRenamed(tab, title)"
            @removed="onRemoved(tab)"
          />
          <CrmNewForm
            v-else
            :entity="tab.entity!"
            :preset-client-id="tab.presetClientId"
            @created="(id, title) => onCreated(tab, id, title)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.crm-panel {
  display: grid;
  grid-template-columns: 140px 1fr;
  height: 100%;

  .crm-nav {
    border-right: 1px solid var(--border);
    background: var(--bg-soft);
    padding-top: 8px;
    overflow-y: auto;

    .nav-item {
      display: block;
      width: 100%;
      padding: 6px 14px;
      border: 0;
      background: none;
      color: var(--fg);
      text-align: left;
      cursor: pointer;

      &:hover { background: var(--bg-hover); }
      &.active { background: var(--bg-hover); color: var(--accent); }

      .icon { display: inline-block; width: 22px; }
    }
  }

  .crm-main {
    display: flex;
    flex-direction: column;
    min-width: 0;

    // 内层 tab 比外层轻量一号，视觉上区分两层
    .inner-tabs :deep(.tab) {
      font-size: 12px;
      padding: 3px 6px 3px 10px;
    }

    .crm-body {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .pane {
      height: 100%;
      overflow: hidden;
    }

    .welcome {
      display: grid;
      place-items: center;
      height: 100%;
      color: var(--fg-dim);
    }
  }
}
</style>
```

- [ ] **Step 2: 工具注册**

Create `packages/ui/src/tools/crm/meta.ts`:

```ts
import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'crm',
  name: { zh: 'CRM', en: 'CRM' },
  desc: { zh: '客户 / 干系人 / 项目管理', en: 'Clients / contacts / projects management' },
  category: 'misc',
  keywords: ['crm', 'customer', 'client', '客户', '干系人', '项目', 'kehu', 'ganxiren', 'xiangmu'],
  icon: '🗂️',
  load: () => import('../../components/crm/CrmPanel.vue'),
}
```

`packages/ui/src/tools/index.ts`：

import 区追加：

```ts
import { meta as crmTool } from './crm/meta'
```

`TOOLS` 数组末尾 `notesTool` 后追加 `crmTool`：

```ts
export const TOOLS: ToolMeta[] = [jsonFormatter, xmlFormatter, yamlFormatter, base64, baseConvert, charCounter, regexTest, textCrypto, passwordGen, uuidGen, qrCode, dateTime, cronTool, colorTools, httpStatus, issueMover, notesTool, crmTool]
```

- [ ] **Step 3: 验证 + 手动冒烟**

Run: `pnpm typecheck`
Expected: 0 error

Run: `pnpm dev` 起应用，冒烟（此时侧边栏 CRM 树与新工具入口并存，属预期）：
1. 侧边栏「其他」分类出现「🗂️ CRM」，点击开外层 tab，默认打开「客户」列表
2. 客户列表「＋新增」→ 新增 tab → 填名称保存 → tab 变身客户详情
3. 客户详情里「＋新增」干系人 → 所属客户已预填 → 保存 → 变身干系人详情
4. 列表删除一条（两步确认）→ 行消失；若其详情 tab 开着应同时关闭

- [ ] **Step 4: 提交**

```bash
git add packages/ui/src/components/crm/CrmPanel.vue packages/ui/src/tools/crm/meta.ts packages/ui/src/tools/index.ts
git commit -m "feat(crm): CrmPanel 内嵌 tab 工作区并注册为工具"
```

---

### Task 10: 清理旧入口（CrmTree / Workspace / SideNav / i18n）

**Files:**
- Modify: `packages/ui/src/Workspace.vue`
- Modify: `packages/ui/src/components/SideNav.vue`
- Delete: `packages/ui/src/components/CrmTree.vue`
- Modify: `packages/ui/src/i18n.ts`

- [ ] **Step 1: Workspace.vue 回归纯工具 tab**

`<script setup>` 整体替换为（template 同步修改见下）：

```ts
import { type Component, computed, onMounted, ref, shallowRef } from 'vue'
import { locale, t } from './i18n'
import { toolById } from './tools/index'
import AiChatPanel from './components/AiChatPanel.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import SideNav from './components/SideNav.vue'
import ToolTabs from './components/ToolTabs.vue'

export interface TabDesc {
  /** Unique key: tool:<toolId> */
  key: string
  /** tool id */
  refId: string
}

const tabs = ref<TabDesc[]>([])
const active = ref<string | null>(null)
/** key → loaded component (filled after async load) */
const comps = shallowRef<Record<string, Component>>({})
const showSettings = ref(false)
const showAi = ref(false)

onMounted(() => {
  window.api?.menu?.onOpenSettings?.(() => {
    showSettings.value = true
  })
})

const toolContext = computed(() => {
  const tab = active.value ? tabs.value.find((x) => x.key === active.value) : null
  if (!tab) return undefined
  const meta = toolById(tab.refId)
  return meta ? `User is on tool "${meta.name.en} / ${meta.name.zh}"` : undefined
})

const tabDisplay = computed(() =>
  tabs.value.map((tab) => {
    const meta = toolById(tab.refId)
    return { key: tab.key, title: meta?.name[locale.value] ?? tab.refId, icon: meta?.icon ?? '' }
  }),
)

async function openTool(toolId: string): Promise<void> {
  const meta = toolById(toolId)
  if (!meta) return
  const key = `tool:${toolId}`
  if (!comps.value[key]) {
    const mod = await meta.load()
    comps.value = { ...comps.value, [key]: mod.default }
  }
  if (!tabs.value.find((x) => x.key === key)) {
    tabs.value = [...tabs.value, { key, refId: toolId }]
  }
  active.value = key
  void window.api?.recents?.touch?.(toolId)
}

function close(key: string): void {
  tabs.value = tabs.value.filter((x) => x.key !== key)
  if (active.value === key) active.value = tabs.value[tabs.value.length - 1]?.key ?? null
}

function reorder(fromKey: string, toKey: string): void {
  const arr = [...tabs.value]
  const fromIdx = arr.findIndex((x) => x.key === fromKey)
  const toIdx = arr.findIndex((x) => x.key === toKey)
  if (fromIdx === -1 || toIdx === -1) return
  const [item] = arr.splice(fromIdx, 1)
  arr.splice(toIdx, 0, item!)
  tabs.value = arr
}
```

template 修改两处：

(a) SideNav 行去掉 ref 与 open-crm：

```html
    <SideNav @open="openTool" />
```

(b) pane 内组件渲染简化：

```html
        <div v-for="tab in tabs" v-show="tab.key === active" :key="tab.key" class="pane">
          <component :is="comps[tab.key]" />
        </div>
```

style 不变。

- [ ] **Step 2: SideNav.vue 移除 CrmTree**

整文件替换 `<script setup>` 与 template（style 不变）：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../registry'
import { locale, t } from '../i18n'
import { TOOLS } from '../tools'

const emit = defineEmits<{ open: [toolId: string] }>()

const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return TOOLS
  return TOOLS.filter(
    (m) =>
      m.name.zh.includes(q) ||
      m.name.en.toLowerCase().includes(q) ||
      m.keywords.some((k) => k.toLowerCase().includes(q)),
  )
})

const grouped = computed(() =>
  CATEGORY_ORDER.map((c) => ({
    cat: c,
    label: CATEGORY_LABEL[c][locale.value],
    tools: filtered.value.filter((m) => m.category === c),
  })).filter((g) => g.tools.length > 0),
)
</script>

<template>
  <nav class="side-nav">
    <input v-model="query" class="input search" :placeholder="t('nav.search')" />
    <div class="scroll">
      <template v-for="g in grouped" :key="g.cat">
        <div class="cat">{{ g.label }}</div>
        <button v-for="m in g.tools" :key="m.id" class="item" :title="m.desc[locale]" @click="emit('open', m.id)">
          <span class="icon">{{ m.icon }}</span>{{ m.name[locale] }}
        </button>
      </template>
    </div>
  </nav>
</template>
```

- [ ] **Step 3: 删除 CrmTree + 清理 i18n 废键**

```bash
git rm packages/ui/src/components/CrmTree.vue
```

`i18n.ts` 删除这一行（其余 crm 键都还在用）：

```ts
  'crm.addClient': { zh: '新建客户', en: 'Add client' },
```

- [ ] **Step 4: 验证**

```bash
grep -rn "CrmTree\|open-crm\|openCrm\|crm-contact\|crm-project\|crm.addClient" packages/ui/src apps/desktop/src
```
Expected: 无结果（引用清干净）

Run: `pnpm typecheck`
Expected: 0 error

- [ ] **Step 5: 提交**

```bash
git add -A packages/ui/src
git commit -m "refactor(crm): 移除侧边栏 CRM 树，外层 tab 回归纯工具"
```

---

### Task 11: 回归验证

**Files:**
- Modify: `docs/踩坑与要点.md`（追加要点）

- [ ] **Step 1: 全量自动验证**

```bash
pnpm typecheck && pnpm test && pnpm lint
```
Expected: typecheck 0 error；vitest 全部 PASS（含新加的迁移/软删/筛选/confirm 用例）；biome 无新告警。若 lint 报新文件格式问题，先 `pnpm format` 再重跑。

- [ ] **Step 2: 手动回归（pnpm dev）**

按场景走一遍：

1. 侧边栏无 CRM 树；「🗂️ CRM」工具入口可搜索到（搜 "crm" / "客户"）
2. 打开 CRM → 默认「客户」列表；左导航三项点击各开各的列表 tab，重复点击只激活不重复开
3. 客户列表：关键字搜索（防抖）、类型筛选、新增→变身详情、详情打开、删除两步确认
4. 干系人列表：所属客户列显示正确、按客户筛选、新增时选客户
5. 项目列表：状态筛选、金额/截止日期列、删除后列表刷新
6. 客户详情：改名保存后列表与 tab 标题同步；关联区块点详情/新增（新增预填客户）；删除客户 → 详情 tab 关闭、其下干系人/项目从各列表消失
7. 项目详情：所属客户只读展示；收款/合同功能不回归（添加/删除收款、上传/打开合同）
8. 重启应用：被删数据不再出现（库里 deleted_at 已打标）
9. 内外两层 tab 拖拽排序、中键关闭都正常；外层其他工具（如记事本）不受影响

- [ ] **Step 3: 追加踩坑要点**

`docs/踩坑与要点.md` 按主题追加（一两句话）：

```markdown
## CRM
- SQLite 加列迁移：`CREATE TABLE IF NOT EXISTS` 不会给老库加列，需 `PRAGMA table_info` 判断后 `ALTER TABLE ADD COLUMN`（幂等）。
- 软删除：list/get 一律过滤 `deleted_at IS NULL`；删客户在事务里给子表打标，比每个查询 JOIN 判断父表干净。
- 嵌套 tab：ToolTabs 是纯展示组件可直接复用；内层 tab「新增变身详情」靠原地改 tab.key 触发重挂载实现。
```

- [ ] **Step 4: 提交**

```bash
git add docs/踩坑与要点.md
git commit -m "docs: 追加 CRM 软删除与内嵌 tab 要点"
```
