# 批量增强实现计划（Monaco / CRM 字段 / 导航折叠 / 项目详情 tab）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地八条使用反馈：Monaco 关闭 Unicode 黄框并自动换行；客户/干系人实体扩字段（含邮箱/性别）；新增表单带全字段；项目详情改分区 tab；左侧导航可折叠。

**Architecture:** Monaco 与导航折叠是壳层两处独立小改；CRM 部分自下而上：schema 守护迁移 → store 签名扩展（TDD）→ 三层契约 → 编辑器/新增表单 UI；项目详情 tab 是 ProjectEditor 纯模板重排。

**Tech Stack:** Electron 34 / Vue 3.5 / TypeScript / SCSS / better-sqlite3 / vitest / monaco-editor

**设计文档:** `docs/superpowers/specs/2026-06-06-batch-enhancements-design.md`

**约定（务必遵守）:**
- git 提交信息：中文 + 约定式前缀，**不带 Co-Authored-By**。
- 不要动 `docs/踩坑与要点.md`（最后回归任务统一写）。
- store 单测 import `better-sqlite3-node`，业务代码 import `better-sqlite3`。
- 跑测试 `pnpm vitest run crmStore`；类型检查 `pnpm typecheck`；全量 `pnpm test`。

---

## 文件清单

| 操作 | 路径 | 职责 |
|---|---|---|
| 改 | `packages/ui/src/components/MonacoEditor.vue:14-24` | wordWrap + unicodeHighlight 选项 |
| 改 | `packages/ui/src/settings.ts` | Settings 加 `navCollapsed` |
| 改 | `packages/ui/src/Workspace.vue` | 折叠按钮 + grid 列切换 |
| 改 | `packages/ui/src/i18n.ts` | nav.collapse/expand + crm 新字段键 |
| 改 | `apps/desktop/src/main/db/schema.ts` | crm_clients 7 列 + crm_contacts.sex，守护循环泛化 |
| 改 | `apps/desktop/src/main/db/crmStore.ts` | Row 接口/映射/create/update 扩展 |
| 改 | `apps/desktop/src/main/db/crmStore.test.ts` | 迁移/全字段往返测试；更新旧调用点 |
| 改 | `packages/shared-types/src/index.ts` | CrmClient/CrmContact 扩展 + Input 类型 + Bridge 签名 |
| 改 | `apps/desktop/src/main/ipc/crm.ts` | create/update 通道签名 |
| 改 | `apps/desktop/src/preload/index.ts` | 同步 bridge 实现 |
| 改 | `packages/ui/src/components/crm/ClientEditor.vue` | 按类型条件字段 |
| 改 | `packages/ui/src/components/crm/ContactEditor.vue` | 性别下拉 |
| 改 | `packages/ui/src/components/crm/CrmNewForm.vue` | 全字段重写 |
| 改 | `packages/ui/src/components/crm/ProjectEditor.vue` | 五分区 tab |

---

### Task 1: Monaco 关闭 Unicode 黄框 + 自动换行

**Files:**
- Modify: `packages/ui/src/components/MonacoEditor.vue:14-24`

- [ ] **Step 1: 加选项**

`monaco.editor.create` 的 options 对象（现有 `smoothScrolling: false,` 之后）追加两项：

```ts
    smoothScrolling: false,
    wordWrap: 'on',
    // 中文输入会大量触发全角字符的「歧义 Unicode」黄框误报，全局关闭
    unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm typecheck` — Expected: 0 error

```bash
git add packages/ui/src/components/MonacoEditor.vue
git commit -m "fix(ui): Monaco 关闭歧义字符黄框误报并开启自动换行"
```

---

### Task 2: 左侧功能导航可折叠

**Files:**
- Modify: `packages/ui/src/settings.ts:40-56`
- Modify: `packages/ui/src/Workspace.vue`
- Modify: `packages/ui/src/i18n.ts`

- [ ] **Step 1: settings 加字段**

`settings.ts` 的 `Settings` 接口在 `navWidth: number` 后加一行：

```ts
  navCollapsed: boolean
```

`defaults()` 在 `navWidth: 240,` 后加：

```ts
    navCollapsed: false,
```

（持久化由既有 deep watch → localStorage + window.api.store 自动覆盖，无需其他改动。）

- [ ] **Step 2: i18n 键**

`i18n.ts` 在 `'nav.recent'` 行之后追加：

```ts
  'nav.collapse': { zh: '收起导航', en: 'Collapse nav' },
  'nav.expand': { zh: '展开导航', en: 'Expand nav' },
```

- [ ] **Step 3: Workspace 接线**

`Workspace.vue` script 的 import 区追加：

```ts
import { settings } from './settings'
```

template 三处修改：

(a) 根节点 class 绑定改为：

```html
  <div class="workspace" :class="{ 'with-ai': showAi, 'nav-collapsed': settings.navCollapsed }">
```

(b) SideNav 行改为：

```html
    <SideNav v-show="!settings.navCollapsed" @open="openTool" />
```

(c) `.tabbar-row` 内 ToolTabs 之前插入切换按钮：

```html
        <button
          class="btn nav-toggle"
          :title="t(settings.navCollapsed ? 'nav.expand' : 'nav.collapse')"
          @click="settings.navCollapsed = !settings.navCollapsed"
        >{{ settings.navCollapsed ? '▶' : '◀' }}</button>
```

style 两处修改（`.workspace` 块内）：

```scss
  &.with-ai { grid-template-columns: 240px 1fr 340px; }
  &.nav-collapsed { grid-template-columns: 0 1fr; }
  &.nav-collapsed.with-ai { grid-template-columns: 0 1fr 340px; }
```

`.tabbar-row` 的样式行追加 nav-toggle（保持原有内容）：

```scss
  .tabbar-row { display: flex; align-items: stretch; .grow { flex: 1; min-width: 0; } .ai-toggle { margin: 6px 8px 0; } .nav-toggle { margin: 6px 0 0 8px; } }
```

- [ ] **Step 4: 验证 + 提交**

Run: `pnpm typecheck` — Expected: 0 error

```bash
git add packages/ui/src/settings.ts packages/ui/src/Workspace.vue packages/ui/src/i18n.ts
git commit -m "feat(ui): 左侧功能导航可折叠并持久化"
```

---

### Task 3: schema 新列守护迁移

**Files:**
- Modify: `apps/desktop/src/main/db/schema.ts`
- Test: `apps/desktop/src/main/db/crmStore.test.ts`

- [ ] **Step 1: 写失败测试**

`crmStore.test.ts` 末尾追加：

```ts
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
})
```

- [ ] **Step 2: 确认失败**

Run: `pnpm vitest run crmStore` — Expected: FAIL（新列不存在）

- [ ] **Step 3: 实现迁移**

(a) `schema.ts` 的 `crm_clients` CREATE TABLE 改为：

```sql
    CREATE TABLE IF NOT EXISTS crm_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'company',
      note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
      deleted_at INTEGER,
      phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      legal_person TEXT NOT NULL DEFAULT '', legal_person_phone TEXT NOT NULL DEFAULT '',
      uscc TEXT NOT NULL DEFAULT '', reg_address TEXT NOT NULL DEFAULT '',
      established_date TEXT NOT NULL DEFAULT ''
    );
```

(b) `crm_contacts` CREATE TABLE 在 `deleted_at INTEGER` 后加 `, sex TEXT NOT NULL DEFAULT ''`。

(c) 把 `migrate()` 末尾现有的「CRM 软删除列」守护循环**整体替换**为泛化版本：

```ts
  // CRM 增量列：CREATE TABLE IF NOT EXISTS 不会给已存在的老库加列，这里守护式补
  const GUARDED_COLUMNS: [table: string, column: string, ddl: string][] = [
    ['crm_clients', 'deleted_at', 'deleted_at INTEGER'],
    ['crm_contacts', 'deleted_at', 'deleted_at INTEGER'],
    ['crm_projects', 'deleted_at', 'deleted_at INTEGER'],
    ['crm_clients', 'phone', "phone TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'email', "email TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'legal_person', "legal_person TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'legal_person_phone', "legal_person_phone TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'uscc', "uscc TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'reg_address', "reg_address TEXT NOT NULL DEFAULT ''"],
    ['crm_clients', 'established_date', "established_date TEXT NOT NULL DEFAULT ''"],
    ['crm_contacts', 'sex', "sex TEXT NOT NULL DEFAULT ''"],
  ]
  for (const [table, column, ddl] of GUARDED_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
    }
  }
```

- [ ] **Step 4: 确认通过**

Run: `pnpm vitest run crmStore` — Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/main/db/schema.ts apps/desktop/src/main/db/crmStore.test.ts
git commit -m "feat(crm): 客户/干系人新字段列守护迁移（法人/信用代码/性别等）"
```

---

### Task 4: crmStore 字段扩展

**Files:**
- Modify: `apps/desktop/src/main/db/crmStore.ts`
- Test: `apps/desktop/src/main/db/crmStore.test.ts`

- [ ] **Step 1: 写失败测试 + 更新旧调用点**

(a) `crmStore.test.ts` 末尾追加：

```ts
describe('extended entity fields', () => {
  it('clients 全字段 create/update 往返', () => {
    const id = store.clients.create({
      name: '某科技公司', type: 'company', email: 'biz@example.com',
      legalPerson: '张法人', legalPersonPhone: '13800000000',
      uscc: '91110000XXXXXXXXXX', regAddress: '北京市朝阳区', establishedDate: '2020-01-01',
    })
    const c = store.clients.get(id)
    expect(c?.legalPerson).toBe('张法人')
    expect(c?.uscc).toBe('91110000XXXXXXXXXX')
    expect(c?.email).toBe('biz@example.com')
    expect(c?.phone).toBe('')
    store.clients.update(id, {
      name: '某科技公司', type: 'person', note: 'n', phone: '13900000000', email: 'p@example.com',
      legalPerson: '张法人', legalPersonPhone: '13800000000',
      uscc: '91110000XXXXXXXXXX', regAddress: '北京市朝阳区', establishedDate: '2020-01-01',
    })
    const c2 = store.clients.get(id)
    expect(c2?.phone).toBe('13900000000')
    expect(c2?.type).toBe('person')
    // 类型切换后公司字段数据保留
    expect(c2?.legalPerson).toBe('张法人')
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
      name: '官网', status: 'done', description: '改版', amountCents: 8000_00, endDate: '2026-12-31',
    })
    const p = store.projects.get(pid)
    expect(p?.status).toBe('done')
    expect(p?.amountCents).toBe(8000_00)
    expect(p?.endDate).toBe('2026-12-31')
    expect(p?.description).toBe('改版')
    // 缺省路径
    const pid2 = store.projects.create(cid, { name: 'P2' })
    expect(store.projects.get(pid2)?.status).toBe('active')
  })
})
```

(b) 更新既有测试的旧签名调用点（contacts/projects 的 create 第二参数从字符串改对象，**全文件检索替换**）：

- `store.contacts.create(cid, '张总')` → `store.contacts.create(cid, { name: '张总' })`
- `store.contacts.create(cidA, '王经理')` → `store.contacts.create(cidA, { name: '王经理' })`
- `store.contacts.create(cidB, '张三本人')` → `store.contacts.create(cidB, { name: '张三本人' })`
- `store.contacts.create(cidA, '孤儿联系人')` → `store.contacts.create(cidA, { name: '孤儿联系人' })`
- `store.projects.create(cid, '项目A')` → `store.projects.create(cid, { name: '项目A' })`
- `store.projects.create(cid, 'P')` → `store.projects.create(cid, { name: 'P' })`
- `store.projects.create(cidA, '官网改版')` → `store.projects.create(cidA, { name: '官网改版' })`
- `store.projects.create(cidB, '小程序')` → `store.projects.create(cidB, { name: '小程序' })`
- `store.projects.create(cidA, '孤儿项目')` → `store.projects.create(cidA, { name: '孤儿项目' })`

（`clients.create({ name, type, note: '' })` 调用保持兼容，note 变为可选。）

- [ ] **Step 2: 确认失败**

Run: `pnpm vitest run crmStore` — Expected: FAIL（类型/列不匹配）

- [ ] **Step 3: 实现**

`crmStore.ts` 修改：

(a) `CrmClientRow` 接口在 `note: string` 后追加：

```ts
  phone: string
  email: string
  legalPerson: string
  legalPersonPhone: string
  uscc: string
  regAddress: string
  establishedDate: string
```

(b) `CrmContactRow` 接口在 `email: string` 后追加：

```ts
  sex: '' | 'male' | 'female'
```

(c) `mapClient` 在 `note:` 行后追加：

```ts
    phone: r.phone as string,
    email: r.email as string,
    legalPerson: r.legal_person as string,
    legalPersonPhone: r.legal_person_phone as string,
    uscc: r.uscc as string,
    regAddress: r.reg_address as string,
    establishedDate: r.established_date as string,
```

(d) `mapContact` 在 `email:` 行后追加：

```ts
    sex: r.sex as '' | 'male' | 'female',
```

(e) `clients.create` / `clients.update` 替换为：

```ts
      create(c: {
        name: string
        type: 'company' | 'person'
        note?: string
        phone?: string
        email?: string
        legalPerson?: string
        legalPersonPhone?: string
        uscc?: string
        regAddress?: string
        establishedDate?: string
      }): number {
        const result = db
          .prepare(
            `INSERT INTO crm_clients(
              name, type, note, phone, email, legal_person, legal_person_phone,
              uscc, reg_address, established_date, created_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            c.name, c.type, c.note ?? '', c.phone ?? '', c.email ?? '',
            c.legalPerson ?? '', c.legalPersonPhone ?? '', c.uscc ?? '',
            c.regAddress ?? '', c.establishedDate ?? '', Date.now(),
          )
        return result.lastInsertRowid as number
      },
      update(id: number, c: Omit<CrmClientRow, 'id' | 'createdAt'>): void {
        db.prepare(
          `UPDATE crm_clients SET
            name = ?, type = ?, note = ?, phone = ?, email = ?,
            legal_person = ?, legal_person_phone = ?, uscc = ?, reg_address = ?, established_date = ?
          WHERE id = ?`,
        ).run(
          c.name, c.type, c.note, c.phone, c.email,
          c.legalPerson, c.legalPersonPhone, c.uscc, c.regAddress, c.establishedDate,
          id,
        )
      },
```

(f) `contacts.create` 替换为：

```ts
      create(
        clientId: number,
        c: {
          name: string
          role?: string
          phone?: string
          wechat?: string
          email?: string
          sex?: '' | 'male' | 'female'
          note?: string
        },
      ): number {
        const result = db
          .prepare(
            'INSERT INTO crm_contacts(client_id, name, role, phone, wechat, email, sex, note, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            clientId, c.name, c.role ?? '', c.phone ?? '', c.wechat ?? '',
            c.email ?? '', c.sex ?? '', c.note ?? '', Date.now(),
          )
        return result.lastInsertRowid as number
      },
```

(g) `contacts.update` 的 SQL 与参数加 sex：

```ts
      update(
        id: number,
        c: Omit<CrmContactRow, 'id' | 'clientId' | 'createdAt'>,
      ): void {
        db.prepare(
          'UPDATE crm_contacts SET name = ?, role = ?, phone = ?, wechat = ?, email = ?, sex = ?, note = ? WHERE id = ?',
        ).run(c.name, c.role, c.phone, c.wechat, c.email, c.sex, c.note, id)
      },
```

(h) `projects.create` 替换为：

```ts
      create(
        clientId: number,
        p: {
          name: string
          status?: 'active' | 'done'
          description?: string
          amountCents?: number
          endDate?: string
        },
      ): number {
        const now = Date.now()
        const result = db
          .prepare(
            `INSERT INTO crm_projects(
              client_id, name, status, description, server_addr, domain, admin_url,
              admin_user, admin_pass, wx_app_id, wx_app_secret, wx_pay_params,
              amount_cents, end_date, created_at, updated_at
            ) VALUES(?, ?, ?, ?, '', '', '', '', '', '', '', '[]', ?, ?, ?, ?)`,
          )
          .run(
            clientId, p.name, p.status ?? 'active', p.description ?? '',
            p.amountCents ?? 0, p.endDate ?? '', now, now,
          )
        return result.lastInsertRowid as number
      },
```

- [ ] **Step 4: 确认通过**

Run: `pnpm vitest run crmStore` — Expected: 全部 PASS
（此时渲染层尚未跟进，`pnpm typecheck` 可能报 desktop 包外的错误，留给 Task 5 解决——本任务只保证 store 测试绿。）

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/main/db/crmStore.ts apps/desktop/src/main/db/crmStore.test.ts
git commit -m "feat(crm): store 支持客户扩展字段/干系人性别/项目基本字段创建"
```

---

### Task 5: 三层契约打通 + i18n 新键

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `apps/desktop/src/main/ipc/crm.ts`
- Modify: `apps/desktop/src/preload/index.ts`
- Modify: `packages/ui/src/i18n.ts`

- [ ] **Step 1: shared-types**

(a) `CrmClient` 替换为：

```ts
export interface CrmClient {
  id: number; name: string; type: 'company' | 'person'; note: string
  phone: string; email: string
  legalPerson: string; legalPersonPhone: string; uscc: string; regAddress: string; establishedDate: string
  createdAt: number
}
```

(b) `CrmContact` 在 `email: string;` 后插入 `sex: '' | 'male' | 'female';`：

```ts
export interface CrmContact { id: number; clientId: number; name: string; role: string; phone: string; wechat: string; email: string; sex: '' | 'male' | 'female'; note: string; createdAt: number }
```

(c) 在 `CrmProjectListItem` 之后追加三个 Input 类型：

```ts
export interface CrmClientInput {
  name: string; type: 'company' | 'person'
  note?: string; phone?: string; email?: string
  legalPerson?: string; legalPersonPhone?: string; uscc?: string; regAddress?: string; establishedDate?: string
}
export interface CrmContactInput {
  name: string
  role?: string; phone?: string; wechat?: string; email?: string; sex?: '' | 'male' | 'female'; note?: string
}
export interface CrmProjectInput {
  name: string
  status?: 'active' | 'done'; description?: string; amountCents?: number; endDate?: string
}
```

(d) `CrmBridge` 内三处签名修改：

```ts
    create(c: CrmClientInput): Promise<number>
    update(id: number, c: Omit<CrmClient, 'id' | 'createdAt'>): Promise<void>
```
（clients；其余成员不动）

```ts
    create(clientId: number, c: CrmContactInput): Promise<number>
```
（contacts；update 声明保持 `Omit<CrmContact, 'id' | 'clientId' | 'createdAt'>`，自动带上 sex）

```ts
    create(clientId: number, p: CrmProjectInput): Promise<number>
```
（projects）

- [ ] **Step 2: IPC handler**

`apps/desktop/src/main/ipc/crm.ts`：

`crm:clients:create` / `crm:clients:update` 替换为：

```ts
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
```

`crm:contacts:create` 替换为：

```ts
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
```

`crm:contacts:update` 的参数类型对象加 `sex: '' | 'male' | 'female'`（紧跟 email 之后）。

`crm:projects:create` 替换为：

```ts
  ipcMain.handle(
    'crm:projects:create',
    (
      _e,
      clientId: number,
      p: { name: string; status?: 'active' | 'done'; description?: string; amountCents?: number; endDate?: string },
    ) => s().projects.create(clientId, p),
  )
```

- [ ] **Step 3: preload**

`apps/desktop/src/preload/index.ts` 的 crm 段（类型可直接 import shared-types 已有的 `WindowApi` 推导，这里按文件既有内联风格写）：

clients：

```ts
      create: (c: {
        name: string; type: 'company' | 'person'; note?: string; phone?: string; email?: string
        legalPerson?: string; legalPersonPhone?: string; uscc?: string; regAddress?: string; establishedDate?: string
      }) => ipcRenderer.invoke('crm:clients:create', c),
      update: (
        id: number,
        c: {
          name: string; type: 'company' | 'person'; note: string; phone: string; email: string
          legalPerson: string; legalPersonPhone: string; uscc: string; regAddress: string; establishedDate: string
        },
      ) => ipcRenderer.invoke('crm:clients:update', id, c),
```

contacts：

```ts
      create: (
        clientId: number,
        c: {
          name: string; role?: string; phone?: string; wechat?: string
          email?: string; sex?: '' | 'male' | 'female'; note?: string
        },
      ) => ipcRenderer.invoke('crm:contacts:create', clientId, c),
```

contacts.update 的内联类型对象在 `email: string` 后加 `sex: '' | 'male' | 'female'`。

projects：

```ts
      create: (
        clientId: number,
        p: { name: string; status?: 'active' | 'done'; description?: string; amountCents?: number; endDate?: string },
      ) => ipcRenderer.invoke('crm:projects:create', clientId, p),
```

- [ ] **Step 4: i18n crm 新键**

`i18n.ts` 在 `'crm.email'` 行后追加：

```ts
  'crm.mobile': { zh: '手机号', en: 'Mobile' },
  'crm.legalPerson': { zh: '公司法人', en: 'Legal person' },
  'crm.legalPersonPhone': { zh: '法人手机号', en: 'Legal person mobile' },
  'crm.uscc': { zh: '统一社会信用代码', en: 'USCC' },
  'crm.regAddress': { zh: '注册地址', en: 'Registered address' },
  'crm.establishedDate': { zh: '成立时间', en: 'Established' },
  'crm.sex': { zh: '性别', en: 'Sex' },
  'crm.male': { zh: '男', en: 'Male' },
  'crm.female': { zh: '女', en: 'Female' },
```

- [ ] **Step 5: 临时修正既有调用点（保证本任务后全仓编译绿）**

渲染层现有两处调用旧 create 签名，本任务先做最小适配（Task 7 再换成全字段表单）：

`packages/ui/src/components/crm/CrmNewForm.vue` 的 `save()` 中三个 create 调用改为：

```ts
    if (props.entity === 'client') {
      id = await window.api?.crm?.clients?.create?.({ name: n, type: type.value })
    } else if (props.entity === 'contact') {
      id = await window.api?.crm?.contacts?.create?.(clientId.value, { name: n })
    } else {
      id = await window.api?.crm?.projects?.create?.(clientId.value, { name: n })
    }
```

`packages/ui/src/components/crm/ClientEditor.vue` 的 `save()` 中 update 调用改为提交全字段（form 此时还没有新字段，先用空串占位，Task 6 接全）：

```ts
    await window.api?.crm?.clients?.update?.(props.refId, {
      name: form.name,
      type: form.type,
      note: form.note,
      phone: '',
      email: '',
      legalPerson: '',
      legalPersonPhone: '',
      uscc: '',
      regAddress: '',
      establishedDate: '',
    })
```

**注意**：此占位会把已存的新字段清空，但 Task 6 同一批落地后即修复；本任务与 Task 6 之间不要发版使用。

`packages/ui/src/components/crm/ContactEditor.vue` 的 form reactive 加 `sex: '' as '' | 'male' | 'female'`，`fillForm` 加 `form.sex = contact.sex`，`save()` 的 update 载荷加 `sex: form.sex`（模板下拉在 Task 6 加，这里先保证类型对齐）。

- [ ] **Step 6: 验证 + 提交**

Run: `pnpm typecheck` — Expected: 0 error
Run: `pnpm vitest run crmStore` — Expected: 全部 PASS

```bash
git add packages/shared-types/src/index.ts apps/desktop/src/main/ipc/crm.ts apps/desktop/src/preload/index.ts packages/ui/src/i18n.ts packages/ui/src/components/crm/CrmNewForm.vue packages/ui/src/components/crm/ClientEditor.vue packages/ui/src/components/crm/ContactEditor.vue
git commit -m "feat(crm): 三层契约支持扩展字段与对象式 create"
```

---

### Task 6: ClientEditor 条件字段 + ContactEditor 性别下拉

**Files:**
- Modify: `packages/ui/src/components/crm/ClientEditor.vue`
- Modify: `packages/ui/src/components/crm/ContactEditor.vue`

- [ ] **Step 1: ClientEditor**

(a) form reactive 替换为：

```ts
const form = reactive({
  name: '',
  type: 'company' as 'company' | 'person',
  note: '',
  phone: '',
  email: '',
  legalPerson: '',
  legalPersonPhone: '',
  uscc: '',
  regAddress: '',
  establishedDate: '',
})
```

(b) `onMounted` 加载客户后的赋值段替换为：

```ts
    form.name = client.name
    form.type = client.type
    form.note = client.note
    form.phone = client.phone
    form.email = client.email
    form.legalPerson = client.legalPerson
    form.legalPersonPhone = client.legalPersonPhone
    form.uscc = client.uscc
    form.regAddress = client.regAddress
    form.establishedDate = client.establishedDate
    dirty.value = false
```

(c) `save()` 的 update 载荷替换为（去掉 Task 5 的空串占位）：

```ts
    await window.api?.crm?.clients?.update?.(props.refId, {
      name: form.name,
      type: form.type,
      note: form.note,
      phone: form.phone,
      email: form.email,
      legalPerson: form.legalPerson,
      legalPersonPhone: form.legalPersonPhone,
      uscc: form.uscc,
      regAddress: form.regAddress,
      establishedDate: form.establishedDate,
    })
```

(d) template 在「类型」field 之后、「备注」field 之前插入条件字段（个人/公司互斥 + 通用邮箱）：

```html
    <template v-if="form.type === 'person'">
      <label class="field">
        <span>{{ t('crm.mobile') }}</span>
        <input v-model="form.phone" class="input" type="text" @input="markDirty" />
      </label>
    </template>
    <template v-else>
      <label class="field">
        <span>{{ t('crm.legalPerson') }}</span>
        <input v-model="form.legalPerson" class="input" type="text" @input="markDirty" />
      </label>
      <label class="field">
        <span>{{ t('crm.legalPersonPhone') }}</span>
        <input v-model="form.legalPersonPhone" class="input" type="text" @input="markDirty" />
      </label>
      <label class="field">
        <span>{{ t('crm.uscc') }}</span>
        <input v-model="form.uscc" class="input" type="text" @input="markDirty" />
      </label>
      <label class="field">
        <span>{{ t('crm.regAddress') }}</span>
        <input v-model="form.regAddress" class="input" type="text" @input="markDirty" />
      </label>
      <label class="field">
        <span>{{ t('crm.establishedDate') }}</span>
        <input v-model="form.establishedDate" class="input" type="date" @input="markDirty" />
      </label>
    </template>
    <label class="field">
      <span>{{ t('crm.email') }}</span>
      <input v-model="form.email" class="input" type="email" @input="markDirty" />
    </label>
```

(e) style：`.field > span` 的 `width: 3em` 改为 `width: 8em`（容纳「统一社会信用代码」）。

- [ ] **Step 2: ContactEditor 性别下拉**

template 在「职位」field 之后插入：

```html
    <label class="field">
      <span>性别</span>
      <select v-model="form.sex" class="input" @change="markDirty">
        <option value="">—</option>
        <option value="male">男</option>
        <option value="female">女</option>
      </select>
    </label>
```

（script 的 sex 字段/fillForm/update 载荷已在 Task 5 完成。）

- [ ] **Step 3: 验证 + 提交**

Run: `pnpm typecheck` — Expected: 0 error

```bash
git add packages/ui/src/components/crm/ClientEditor.vue packages/ui/src/components/crm/ContactEditor.vue
git commit -m "feat(crm): 客户编辑器按类型条件字段，干系人编辑器性别下拉"
```

---

### Task 7: CrmNewForm 全字段

**Files:**
- Modify: `packages/ui/src/components/crm/CrmNewForm.vue`（整文件替换）

- [ ] **Step 1: 整文件替换为**

```vue
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { CrmClient } from '@lele/shared-types'
import { t } from '../../i18n'
import { yuanToCents } from '../../money'

const props = defineProps<{ entity: 'client' | 'contact' | 'project'; presetClientId?: number }>()
const emit = defineEmits<{ created: [id: number, title: string] }>()

const name = ref('')
const clientId = ref<number>(props.presetClientId ?? 0)
const clients = ref<CrmClient[]>([])
const busy = ref(false)

// 各实体的选填字段（必填只有 name 与 clientId）
const client = reactive({
  type: 'company' as 'company' | 'person',
  phone: '',
  email: '',
  legalPerson: '',
  legalPersonPhone: '',
  uscc: '',
  regAddress: '',
  establishedDate: '',
})
const contact = reactive({
  wechat: '',
  phone: '',
  sex: '' as '' | 'male' | 'female',
  role: '',
  email: '',
  note: '',
})
const project = reactive({
  status: 'active' as 'active' | 'done',
  amountYuan: '',
  endDate: '',
  description: '',
})

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
      id = await window.api?.crm?.clients?.create?.({
        name: n,
        type: client.type,
        phone: client.phone,
        email: client.email,
        legalPerson: client.legalPerson,
        legalPersonPhone: client.legalPersonPhone,
        uscc: client.uscc,
        regAddress: client.regAddress,
        establishedDate: client.establishedDate,
      })
    } else if (props.entity === 'contact') {
      id = await window.api?.crm?.contacts?.create?.(clientId.value, {
        name: n,
        wechat: contact.wechat,
        phone: contact.phone,
        sex: contact.sex,
        role: contact.role,
        email: contact.email,
        note: contact.note,
      })
    } else {
      id = await window.api?.crm?.projects?.create?.(clientId.value, {
        name: n,
        status: project.status,
        description: project.description,
        amountCents: yuanToCents(project.amountYuan),
        endDate: project.endDate,
      })
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
    <label v-if="needClient" class="field">
      <span>{{ t('crm.client') }}</span>
      <select v-model.number="clientId" class="input">
        <option :value="0" disabled>—</option>
        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>

    <!-- 客户 -->
    <template v-if="entity === 'client'">
      <label class="field">
        <span>{{ t('crm.type') }}</span>
        <select v-model="client.type" class="input">
          <option value="company">{{ t('crm.company') }}</option>
          <option value="person">{{ t('crm.person') }}</option>
        </select>
      </label>
      <template v-if="client.type === 'person'">
        <label class="field">
          <span>{{ t('crm.mobile') }}</span>
          <input v-model="client.phone" class="input" type="text" />
        </label>
      </template>
      <template v-else>
        <label class="field">
          <span>{{ t('crm.legalPerson') }}</span>
          <input v-model="client.legalPerson" class="input" type="text" />
        </label>
        <label class="field">
          <span>{{ t('crm.legalPersonPhone') }}</span>
          <input v-model="client.legalPersonPhone" class="input" type="text" />
        </label>
        <label class="field">
          <span>{{ t('crm.uscc') }}</span>
          <input v-model="client.uscc" class="input" type="text" />
        </label>
        <label class="field">
          <span>{{ t('crm.regAddress') }}</span>
          <input v-model="client.regAddress" class="input" type="text" />
        </label>
        <label class="field">
          <span>{{ t('crm.establishedDate') }}</span>
          <input v-model="client.establishedDate" class="input" type="date" />
        </label>
      </template>
      <label class="field">
        <span>{{ t('crm.email') }}</span>
        <input v-model="client.email" class="input" type="email" />
      </label>
    </template>

    <!-- 干系人 -->
    <template v-else-if="entity === 'contact'">
      <label class="field">
        <span>{{ t('crm.wechat') }}</span>
        <input v-model="contact.wechat" class="input" type="text" />
      </label>
      <label class="field">
        <span>{{ t('crm.mobile') }}</span>
        <input v-model="contact.phone" class="input" type="text" />
      </label>
      <label class="field">
        <span>{{ t('crm.sex') }}</span>
        <select v-model="contact.sex" class="input">
          <option value="">—</option>
          <option value="male">{{ t('crm.male') }}</option>
          <option value="female">{{ t('crm.female') }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ t('crm.role') }}</span>
        <input v-model="contact.role" class="input" type="text" />
      </label>
      <label class="field">
        <span>{{ t('crm.email') }}</span>
        <input v-model="contact.email" class="input" type="email" />
      </label>
      <label class="field field-textarea">
        <span>{{ t('crm.note') }}</span>
        <textarea v-model="contact.note" class="input" rows="3" />
      </label>
    </template>

    <!-- 项目 -->
    <template v-else>
      <label class="field">
        <span>{{ t('crm.status') }}</span>
        <select v-model="project.status" class="input">
          <option value="active">{{ t('crm.statusActive') }}</option>
          <option value="done">{{ t('crm.statusDone') }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ t('crm.amount') }}</span>
        <input v-model="project.amountYuan" class="input" type="text" placeholder="0.00" />
      </label>
      <label class="field">
        <span>{{ t('crm.endDate') }}</span>
        <input v-model="project.endDate" class="input" type="date" />
      </label>
      <label class="field field-textarea">
        <span>{{ t('crm.note') }}</span>
        <textarea v-model="project.description" class="input" rows="3" />
      </label>
    </template>

    <div class="actions">
      <button class="btn btn-primary" :disabled="!canSave || busy" @click="save">保存</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.crm-new-form {
  max-width: 520px;

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
      width: 8em;
      flex-shrink: 0;
    }

    .input { flex: 1; min-width: 0; }

    &.field-textarea {
      align-items: flex-start;

      > span { padding-top: 4px; }
    }
  }

  .actions { padding-left: calc(8em + 12px); }
}
</style>
```

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm typecheck` — Expected: 0 error

```bash
git add packages/ui/src/components/crm/CrmNewForm.vue
git commit -m "feat(crm): 新增表单带各实体全量选填字段"
```

---

### Task 8: ProjectEditor 五分区 tab

**Files:**
- Modify: `packages/ui/src/components/crm/ProjectEditor.vue`

纯模板/样式重排：script 逻辑（payments/files/wxPayRows/dirty/save）不动，只加一个分区状态。

- [ ] **Step 1: script 加分区状态**

`const dirty = ref(false)` 之前插入：

```ts
const SECTIONS = [
  { key: 'basic', label: '基本信息' },
  { key: 'deploy', label: '部署信息' },
  { key: 'wx', label: '微信' },
  { key: 'payments', label: '收款记录' },
  { key: 'files', label: '合同' },
] as const
const activeSection = ref<(typeof SECTIONS)[number]['key']>('basic')
```

- [ ] **Step 2: template 重排**

(a) top-bar 之后（`</div>` 闭合 top-bar 后）插入分段 tab 条：

```html
    <div class="section-tabs">
      <button
        v-for="s in SECTIONS"
        :key="s.key"
        type="button"
        class="seg"
        :class="{ active: activeSection === s.key }"
        @click="activeSection = s.key"
      >{{ s.label }}</button>
    </div>
```

(b) 删除五个 `<h4 class="section-title">…</h4>` 标题行（基本信息/部署信息/微信/收款记录/合同），并把五个区域分别用 v-show 容器包裹：

- `<div v-show="activeSection === 'basic'">` 包住：「所属客户」只读 field 起、到「结束时间」field 止
- `<div v-show="activeSection === 'deploy'">` 包住：「服务器地址」field 起、到「访问密码」field（SecretInput）止
- `<div v-show="activeSection === 'wx'">` 包住：「appId」field 起、到 `.wx-pay-params` div 止
- `<div v-show="activeSection === 'payments'">` 包住：`.payments-table` 起、到 `.payment-summary` div 止（含「＋添加收款」按钮）
- `<div v-show="activeSection === 'files'">` 包住：`.files-list` / `暂无合同` 提示起、到「上传合同」按钮止

每个容器独立闭合 `</div>`，缩进保持文件风格。

- [ ] **Step 3: style 调整**

删除 `.section-title` 样式块，新增：

```scss
  .section-tabs {
    display: flex;
    gap: 4px;
    margin: 10px 0 12px;
    border-bottom: 1px solid var(--border);

    .seg {
      border: 0;
      background: none;
      color: var(--fg-dim);
      padding: 6px 12px;
      cursor: pointer;
      font-size: 13px;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;

      &:hover { color: var(--fg); }

      &.active {
        color: var(--accent);
        border-bottom-color: var(--accent);
        font-weight: 600;
      }
    }
  }
```

- [ ] **Step 4: 验证 + 提交**

Run: `pnpm typecheck` — Expected: 0 error

```bash
git add packages/ui/src/components/crm/ProjectEditor.vue
git commit -m "feat(crm): 项目详情按基本/部署/微信/收款/合同分区 tab"
```

---

### Task 9: 回归验证

- [ ] **Step 1: 自动门**

```bash
pnpm typecheck && pnpm test && pnpm lint
```
Expected: 0 error / 全部 PASS / 无新告警。若 lint 对本批新改文件报格式问题，`pnpm format` 后重跑；无关既有文件问题原样报告。

- [ ] **Step 2: 手动回归（pnpm dev，可用 CDP 9222 驱动，断言前先把窗口带前台）**

1. JSON/XML/YAML 格式化与记事本：粘贴含全角逗号/全角空格的中文文本 → 无黄框；超长行自动换行、无横向滚动条
2. 导航折叠：点 ◀ 整栏收起、▶ 展开；折叠后开工具/CRM 正常；重启应用折叠状态保持
3. 新建客户（公司）：填法人/信用代码/注册地址/成立时间/邮箱 → 保存变身详情，字段回显；切类型为个人 → 显示手机号、公司字段隐藏；切回公司 → 数据仍在
4. 新建干系人：微信/手机号/性别/职位/邮箱/备注全填 → 详情回显性别正确；性别留空也能保存
5. 新建项目：状态/金额/截止日期/说明 → 详情「基本信息」分区回显，金额列表显示一致
6. 项目详情：五个分区 tab 切换；在「收款记录」加一笔、删一笔；「合同」上传/打开（文件对话框路径不便自动化可手动）；切 tab 后未保存的 dirty 状态不丢
7. 既有数据（迁移前创建的客户/干系人）打开不报错，新字段为空
8. 客户/干系人/项目列表的查询、删除（逻辑删除）不回归

- [ ] **Step 3: 踩坑要点 + 提交**

`docs/踩坑与要点.md` 的 `## CRM` 节追加：

```markdown
- 实体加列三件套：CREATE TABLE 同步带列 + GUARDED_COLUMNS 守护 ALTER + mapXxx/Row/Bridge/IPC/preload 五层同改，漏一层 typecheck 才会暴露。
```

`## CDP 自动化验证 Electron 渲染层` 节追加：

```markdown
- Monaco 的「黄框」是 unicodeHighlight 对全角字符的歧义高亮，不是诊断 marker；中文场景直接 ambiguousCharacters/invisibleCharacters 双关。
```

```bash
git add docs/踩坑与要点.md
git commit -m "docs: 追加实体加列与 Monaco unicodeHighlight 要点"
```
