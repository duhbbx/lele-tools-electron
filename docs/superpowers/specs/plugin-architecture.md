# 构建期插件架构（私有模块与开源壳分离）

## 动机

仓库开源，但 CRM 等模块只想自用。把「壳」（工具框架/记事本/通用基建）与「私有插件」分离：
公共仓库只含插件插槽，私有代码放 `plugins/<id>/`（被 .gitignore，独立 git 仓库），
clone 开源仓库的人没有 plugins 目录，应用照常构建运行，只是没有对应工具。

## 形态：构建期插件（非运行时）

插件是 pnpm workspace 包（`plugins/*`），与壳一起编译、一起 typecheck、一起跑测试。
发现机制是 `import.meta.glob`（Vite 构建期文件系统扫描），目录不存在即空集，零运行时开销。

## 插件包结构

```
plugins/<id>/
  package.json        @lele/plugin-<id>，依赖 @lele/ui / @lele/shared-types
  tsconfig.json       vue-tsc，覆盖 ui/main/shared 三层
  global.d.ts         window.api 类型声明
  shared/types.ts     插件自己的领域类型（不进 @lele/shared-types）
  ui/index.ts         export const plugin: LelePluginUi = { tools, i18n }
  ui/api.ts           基于 window.api.plugin.invoke 的带类型 IPC 客户端
  ui/components/…     Vue 组件
  main/index.ts       export const plugin: LelePluginMain = { id, migrate, registerIpc, resolveFile }
  main/<x>Store.ts    数据层（+ 同目录单测，import better-sqlite3-node）
  main/ipc.ts         IPC handler
```

## 壳层插槽（公共仓库）

| 插槽 | 位置 | 说明 |
|---|---|---|
| 工具注册 | `@lele/ui` `registerTools(metas)` | 渲染层 main.ts 在 mount 前注入 |
| 文案 | `@lele/ui` `extendDict(entries)` | 插件 i18n 字典合入壳层 dict |
| 渲染层发现 | `apps/desktop/src/renderer/src/main.ts` | `import.meta.glob('../../../../../plugins/*/ui/index.ts', { eager: true })` |
| 主进程发现 | `apps/desktop/src/main/plugins.ts` | `import.meta.glob('../../../../plugins/*/main/index.ts', { eager: true })` |
| 建表/迁移 | `db/sqlite.ts` getDb() 内、基础 migrate 之后 | `plugin.migrate(db)`，插件自管 CREATE TABLE IF NOT EXISTS + 守护补列 |
| IPC | `main/index.ts` whenReady | `plugin.registerIpc(ctx)`，ctx 提供 `getDb()` |
| 本地文件协议 | 壳注册 `plugin-file://`，按 hostname 路由 | `plugin-file://<pluginId>/...` → `plugin.resolveFile(url)`；CSP img-src 放行 `plugin-file:` |
| IPC 桥 | preload `window.api.plugin.invoke(channel, ...args)` | 通用透传，插件渲染层自己包带类型客户端 |

插件契约类型：`LelePluginMain`/`PluginMainContext` 在 `@lele/shared-types`（db 用 unknown，两侧各自收窄）；
`LelePluginUi` 在 `@lele/ui`（依赖 ToolMeta）。

## 取舍

- preload 通用透传弱化了「逐条白名单」的桥风格；本应用渲染层全为第一方代码、contextIsolation 开启，可接受。
- 插件频道命名沿用 `模块:实体:操作`（如 `crm:clients:list`），与壳层频道同栈不冲突即可。
- 已推送到远端的历史提交不受影响（剥离只管未来）。

## 首个插件：CRM

CRM 全量迁入 `plugins/crm`：9 个组件 + crmStore(+测试) + IPC + crm 表迁移 + crm.* 文案 + Crm* 类型。
身份证图片协议从 `crm-file://idcard/...` 改为 `plugin-file://crm/idcard/...`。
公共层删除全部 CRM 痕迹；用户 DB 不动（插件 migrate 与原 DDL 等价幂等）。
