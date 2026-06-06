# 批量增强设计：Monaco 体验 / CRM 字段扩展 / 导航折叠 / 项目详情 tab

日期：2026-06-06
状态：已确认

## 背景

CRM 内嵌 tab 改造（见 `2026-06-06-crm-tabs-redesign-design.md`）落地后的一批使用反馈增强，横跨三个子系统：Monaco 编辑器（格式化工具+记事本共享）、CRM 实体字段与表单、壳层导航。改动均不大，合并为一份 spec、一个实现计划。

## 已确认的需求决策

| 决策点 | 结论 |
|---|---|
| 个人客户的「姓名」 | 复用现有 name（客户名称即姓名），只新增手机号/邮箱 |
| 项目新增表单字段范围 | 基本信息字段（名称/客户必填，状态/金额/截止日期/说明选填），部署/微信/收款/合同仍在详情补 |
| 项目详情 tab 分组 | 五个 tab 照现有五个 section：基本信息/部署信息/微信/收款记录/合同 |
| 导航折叠形态 | 完全收起（grid 列归零），tab 栏左端常驻切换按钮，状态持久化 |

## 1. Monaco（共享 MonacoEditor.vue，一处改动覆盖 JSON/XML/YAML 格式化与记事本）

`packages/ui/src/components/MonacoEditor.vue` 的 `monaco.editor.create` options 增加：

- `unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false }`
  —— 现状的"黄框"是 Monaco 对歧义 Unicode 字符（全角逗号、全角空格等）的高亮，输入中文内容时全是误报，全局关闭。
- `wordWrap: 'on'` —— 长行自动换行，横向滚动条随之消失。

不动 JSON 校验逻辑：中文逗号导致的 JSON 解析错误仍由 json-formatter 现有 `JSON.parse` 错误文案兜底提示。

## 2. 客户字段扩展（含邮箱）

### 数据层
`crm_clients` 新增 7 列，全部 `TEXT NOT NULL DEFAULT ''`，沿用 deleted_at 的守护式迁移模式（`PRAGMA table_info` 判断后 `ALTER TABLE ADD COLUMN`，同时写进 CREATE TABLE）：

| 列 | 含义 | 适用类型 |
|---|---|---|
| `phone` | 手机号 | 个人 |
| `email` | 邮箱 | 通用 |
| `legal_person` | 公司法人 | 公司 |
| `legal_person_phone` | 法人手机号 | 公司 |
| `uscc` | 统一社会信用代码 | 公司 |
| `reg_address` | 注册地址 | 公司 |
| `established_date` | 成立时间（date 字符串，同 end_date 风格） | 公司 |

### 契约与 UI
- `CrmClient` / `CrmClientRow` 扩展同名 camelCase 字段；`clients.create` 改为接收完整对象（`{ name, type, note, phone, email, legalPerson, legalPersonPhone, uscc, regAddress, establishedDate }`），`clients.update` 同步；IPC `crm:clients:create/update` 与 preload 同步改签名。
- ClientEditor 表单**按类型条件显示**：个人 → 手机号、邮箱；公司 → 法人、法人手机号、统一社会信用代码、注册地址、成立时间、邮箱。切换类型时另一组字段隐藏但已填数据保留（保存时原样提交全部字段）。
- 客户列表不加列（YAGNI）。

## 3. 干系人字段（性别）

- `crm_contacts` 新增 `sex TEXT NOT NULL DEFAULT ''`，取值 `'' | 'male' | 'female'`，界面显示 —/男/女。
- `CrmContact` / store update / IPC / preload 同步加 `sex`。
- `contacts.create(clientId, c)` 改为接收全字段对象（`{ name, role, phone, wechat, email, sex, note }`，除 name 外均可空串）。
- ContactEditor 在「职位」后加「性别」下拉（—/男/女）。

## 4. 项目详情改内部分区 tab

`ProjectEditor.vue` 重排模板：

- 顶栏不变（标题 / 保存 / 删除项目）。
- 顶栏下方加一条轻量分段 tab（自有样式 `.section-tabs`，非 ToolTabs）：**基本信息 / 部署信息 / 微信 / 收款记录 / 合同**，与现有五个 section 一一对应。
- 用 `v-show` 切换分区，保留各区组件状态；dirty/保存逻辑不变（保存一次提交前三区全部字段）；「所属客户」只读行在基本信息分区内。
- 脚本逻辑（payments/files/wxPayRows 等）不动，纯模板/样式重排。

## 5. 新增表单带全字段（CrmNewForm）

- **客户**：名称+类型必填；按类型条件显示 §2 的选填字段（个人：手机号/邮箱；公司：法人/法人手机号/统一社会信用代码/注册地址/成立时间/邮箱）。
- **干系人**：姓名+所属客户必填；微信/手机号/性别/职位/邮箱/备注选填。
- **项目**：名称+所属客户必填；状态/金额(元)/截止日期/情况说明选填。`projects.create(clientId, p)` 扩展为接收 `{ name, status?, description?, amountCents?, endDate? }`。
- 保存后 tab 原地变身详情的机制不变；canSave 仍只看必填项。
- 金额输入用现有 `yuanToCents` 转换。

## 6. 左侧功能导航可折叠

- Workspace 增加 `navCollapsed` 状态：折叠时 grid 第一列收为 0（SideNav v-show 隐藏），展开恢复 240px；`.with-ai` 三列布局同步适配。
- tab 栏行左端常驻一个 ◀/▶ 切换按钮（在 ToolTabs 之前）。
- 状态持久化：进现有 settings 机制（`packages/ui/src/settings.ts`，`window.api.store` + localStorage 水合），新增 `navCollapsed: boolean` 字段，重启保持。

## 7. i18n

新增键（zh/en）：`crm.mobile` 手机号、`crm.legalPerson` 法人、`crm.legalPersonPhone` 法人手机号、`crm.uscc` 统一社会信用代码、`crm.regAddress` 注册地址、`crm.establishedDate` 成立时间、`crm.sex` 性别、`crm.male` 男、`crm.female` 女、`nav.collapse` 收起导航、`nav.expand` 展开导航。（crm.email/phone 等已存在。）

## 8. 测试与回归

- crmStore 单测：新列守护式迁移幂等（含老库 ALTER 路径）、clients/contacts/projects 的 create/update 全字段往返、新字段在 list/get 的映射。
- 手动回归：三个格式化工具+记事本输入中文标点无黄框、长行自动换行无横向滚动条；三实体新增表单（必填校验、条件字段、保存变身详情）；客户类型切换条件字段数据保留；项目详情五 tab 切换且收款/合同功能不回归；导航折叠/展开、重启保持。

## 不做

- 客户/干系人列表不加新列。
- 字段格式校验（手机号/邮箱/信用代码格式）不做，纯文本存储。
- 导航折叠不做图标窄栏形态。
