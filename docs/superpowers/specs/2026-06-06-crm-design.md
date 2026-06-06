# CRM 模块设计文档

日期：2026-06-06
状态：已与 owner 确认（数据层级 / 合同存储 / 敏感字段 / 优先级四问已答）

## 一句话

在 lele-tools-electron 内做一个本地 CRM：客户（公司/个人）→ 干系人（多）+ 项目（多），项目内记录部署信息、微信参数、金额与收款、合同文件、结束时间；左导航新增 CRM 树，条目在全局 Tab 区打开编辑。

## 数据模型（沿用 lele.db，新增 5 表）

```sql
crm_clients   (id PK, name, type 'company'|'person', note, created_at)
crm_contacts  (id PK, client_id FK→clients ON DELETE CASCADE, name, role, phone, wechat, email, note, created_at)
crm_projects  (id PK, client_id FK→clients ON DELETE CASCADE, name, status 'active'|'done',
               description, server_addr, domain, admin_url, admin_user, admin_pass,
               wx_app_id, wx_app_secret, wx_pay_params TEXT(JSON 键值对数组),
               amount_cents INTEGER, end_date TEXT(ISO date), created_at, updated_at)
crm_payments  (id PK, project_id FK→projects ON DELETE CASCADE, amount_cents INTEGER, paid_at TEXT, note)
crm_files     (id PK, project_id FK→projects ON DELETE CASCADE, name 原文件名, stored_path 相对路径, size, uploaded_at)
```

- 金额一律**分**（INTEGER）存储，界面元两位小数。
- 微信支付参数：不可枚举（"等等"），用键值对数组 JSON 存 `wx_pay_params`，UI 可增删行。
- 敏感字段（admin_pass / wx_app_secret / 支付参数值）**明文存 sqlite**（本地单机），UI 默认打码、点 👁 显示、可复制。
- 合同文件：系统文件选择框选中后**拷贝**到 `userData/crm-files/<projectId>/`，库存相对路径；点击用系统默认应用打开（shell.openPath）；删除时同时删文件。

## 导航与 Tab

- **SideNav 新增 CRM 树区**（工具分类下方，可折叠）：客户列表（+新建）→ 每客户展开「干系人 / 项目」两目录（各自 +新建）→ 点条目开 Tab。删除入口在树节点（hover ×，二次确认）。
- **Tab 系统泛化**（本功能最大架构动作）：tabs 由 `string[]`（toolId）改为描述符 `{ key, kind: 'tool'|'crm-contact'|'crm-project', refId?, }`；title/icon 按 kind 解析（tool 走 registry；crm 条目走实体名，改名后响应更新）。既有 15+1 工具行为不变。
- 编辑器组件：`ContactEditor.vue`、`ProjectEditor.vue`（按 refId 加载，显式「保存」按钮 + 脏标记）。

## 项目编辑器分区

1. 基本信息：名称、状态（进行中/已完结）、情况说明、项目金额、结束时间
2. 部署信息：服务器地址、域名、后台访问地址、访问用户、访问密码
3. 微信：appId、appSecret、支付参数（键值对增删行）
4. 收款记录：表格（金额/日期/备注）+ 添加/删除行；显示 已收合计 与 未收余额（金额-合计）
5. 合同：文件列表（名称/大小/时间）+ 上传 / 打开 / 删除

## IPC（CrmBridge，token 类比照既有 store 桥模式）

clients/contacts/projects CRUD + list；payments list/add/remove；files list/pick(系统对话框+拷贝)/open/remove。主进程持文件系统操作，渲染层只拿元数据。

## 不做（YAGNI）

- 不做搜索/筛选/统计报表（数据量个人级，树+Tab 足够）
- 不做导入导出（sqlite 文件本身可备份）
- 不做多用户/同步
