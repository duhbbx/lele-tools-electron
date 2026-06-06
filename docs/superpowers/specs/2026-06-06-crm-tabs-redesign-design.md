# CRM 内嵌 Tab 工作区改造设计

日期：2026-06-06
状态：已确认

## 背景与目标

现状：CRM 以树形结构（`CrmTree.vue`）嵌在侧边栏，客户→干系人/项目层级展开，点叶子节点在外层工作区开 tab（`crm-contact:<id>` / `crm-project:<id>` 两种 TabDesc kind）。

目标：CRM 收敛为侧边栏单一工具入口，所有客户/干系人/项目的浏览与编辑都在 CRM 工具 tab **内部**完成——内部左导航 + 内部多 tab，列表页带查询条件、新增按钮、操作列（详情/逻辑删除）。

## 已确认的需求决策

| 决策点 | 结论 |
|---|---|
| 逻辑删除 | 加 `deleted_at`，删除后仅隐藏，不提供 UI 恢复入口 |
| 干系人/项目列表范围 | 全量平铺，表格带「所属客户」列，查询条件可按客户筛选 |
| 侧边栏 CrmTree | 删除，换成工具 registry 中的单一「CRM」入口 |
| 查询条件 | 按实体定制（见下） |
| 新增/详情交互 | 都开内部 tab；新增 tab 保存后原地变身详情 tab |
| 客户详情 | 展示基本信息 + 该客户的干系人/项目关联列表（可跳转、可带客户新增） |

## 整体结构

- CRM 注册为工具 registry 的普通工具（id: `crm`），点击在外层工作区开一个工具 tab。
- 新增 `packages/ui/src/components/crm/CrmPanel.vue` 作为根组件，内部三栏：
  - 左侧迷你导航（固定窄栏）：客户 / 干系人 / 项目
  - 顶部内部 tab 栏：复用 `ToolTabs.vue`，样式轻量化以与外层区分
  - 内容区：渲染当前内部 tab 组件
- 内部 tab 类型（CrmPanel 内 `ref` 管理，不持久化）：
  - `list:clients` / `list:contacts` / `list:projects` — 点左导航打开或激活，每种唯一
  - `client:<id>` / `contact:<id>` / `project:<id>` — 详情 tab
  - `new:client` / `new:contact` / `new:project` — 新增 tab，保存成功后变身详情 tab
- 清理：删除 `CrmTree.vue`；`SideNav.vue` 移除嵌入；`Workspace.vue` 的 `TabDesc` 删掉 `crm-contact`/`crm-project` kind，回归纯工具 tab。

## 列表页（ClientList / ContactList / ProjectList）

统一布局：顶部查询栏 + 新增按钮；下方表格；输入即查（防抖），无单独查询按钮。

查询条件：
- 客户：名称关键字、类型（全部/公司/个人）
- 干系人：名称关键字、所属客户（下拉）
- 项目：名称关键字、状态（全部/进行中/已完成）、所属客户（下拉）

表格列：
- 客户：名称、类型、备注、创建时间、操作
- 干系人：姓名、所属客户、角色、电话、微信、邮箱、操作
- 项目：名称、所属客户、状态、金额、截止日期、操作

操作列：「详情」开内部详情 tab；「删除」沿用现有两步确认模式，逻辑删除后刷新列表并关闭该记录已打开的详情 tab。

## 详情/新增页

- **ClientEditor.vue（新建）**：上半部分基本信息表单（名称/类型/备注，dirty + 保存，沿用现有编辑器模式）；下半部分两个关联区块——该客户的干系人列表、项目列表（简单表格，点行开内部详情 tab；区块内「新增」开新增 tab 并预填所属客户）。
- **ContactEditor / ProjectEditor（改造）**：
  - 在 CrmPanel 内部渲染，保存改名/删除事件发给 CrmPanel
  - 顶部增加「所属客户」：详情模式只读展示；新增模式为客户下拉（必选，可预填）
  - 新增模式保存后创建记录，tab 变身详情
- 保存/删除后向相关列表 tab 广播刷新（CrmPanel 内事件或版本号机制）。

## 数据层与 IPC

- **迁移**：启动时守护式 `ALTER TABLE ... ADD COLUMN deleted_at TEXT`，作用于 `crm_clients` / `crm_contacts` / `crm_projects`。`crm_payments` / `crm_files` 随项目走，保持物理删除。
- **crmStore**：
  - 所有 list/get 过滤 `deleted_at IS NULL`
  - `remove()` 改为 `UPDATE ... SET deleted_at = <now>`；删除客户时在事务里把其下干系人/项目一并打标
  - 新增筛选查询：`clients.list({q?, type?})`、`contacts.listAll({q?, clientId?})`、`projects.listAll({q?, status?, clientId?})`，后两者 JOIN 出客户名；`listByClient` 保留给客户详情页
- **IPC/preload/shared-types**：按 `crm:<area>:<op>` 约定补充通道与 `CrmBridge` 方法。

## 测试与回归

- `crmStore.test.ts` 补：逻辑删除后 list/get 不可见、删客户级联打标、筛选查询（关键字/类型/状态/客户）。
- UI dev 手工回归：开 CRM tab → 三个列表 → 新增/详情/删除 → 客户详情关联区块跳转。
- i18n：补充列表/查询/操作列新键，删除废弃键。

## 不做

- 已删除数据的查看/恢复 UI（数据保留在库里，需要时手动改库）
- 分页（本地单机数据量小，全量渲染）
- 内部 tab 状态持久化
