# lele-tools-electron

乐乐的工具箱（Electron 版）。Qt 版 lele-tools 的重写：15+ 开发者工具 + CRM + AI 助手 + Markdown 记事本。

## 技术栈与结构

Electron 34 / Vue 3.5 / Vite 6（electron-vite）/ TypeScript / SCSS / Monaco Editor / better-sqlite3 / marked。pnpm monorepo：

- `apps/desktop` — Electron 壳：`src/main`（主进程：ipc/、db/）、`src/preload`、`src/renderer`（只挂载 @lele/ui 的 Workspace）
- `packages/ui` — 全部界面与工具实现（Vue 组件库）
- `packages/shared-types` — 渲染层 ↔ 主进程 IPC 契约（WindowApi）
- `apps/website` — 官网

## 常用命令

```bash
export PYTHON=python3.9   # macOS 首次 pnpm install 编译原生模块必须（默认 python3.14 没有 distutils）
pnpm install
pnpm dev          # 起桌面应用（electron-vite dev；调试加 -- --remote-debugging-port=9222）
pnpm typecheck    # 全仓类型检查（node + web）
pnpm test         # vitest 全量单测
pnpm lint         # biome
pnpm dist         # 打包
```

## 模式约定（新增功能照这些套路走）

- **新增工具**：`packages/ui/src/tools/<id>/` 下建 `meta.ts`（ToolMeta）+ `Tool.vue`，在 `tools/index.ts` 注册即可；侧边栏/搜索/标签页自动生效。纯逻辑抽成 `.ts` 纯函数 + 同目录 `.test.ts`。
- **需要主进程能力的模块**（DB/文件/网络）：参考 CRM 与 notes 模块四件套——
  1. `apps/desktop/src/main/db/schema.ts` 加表（全部 `CREATE TABLE IF NOT EXISTS`，增量安全）；
  2. `db/<x>Store.ts` 写 `make<X>Store(db)` 工厂（可用内存库单测）；
  3. `main/ipc/<x>.ts` 写 `register<X>Ipc()`，频道命名 `模块:实体:操作`，在 `main/index.ts` 注册；
  4. `shared-types` 加 Bridge 接口 → `preload/index.ts` 实现挂到 `window.api.<x>`。
- **单测**：vitest，node 环境；主进程 store 测试 import `better-sqlite3-node`（Node ABI），业务代码 import `better-sqlite3`（Electron ABI），不要混。递归 CTE 一律用 `UNION`（不是 `UNION ALL`，防数据环死循环）。
- **附件存储**：拷到 `userData/<模块>-files/<ownerId>/`，DB 记 userData 相对路径，删除时同步清理目录；落盘文件名一律先过 `basename()`（防路径穿越）。渲染层读本地附件走自定义协议（见 `ipc/notes.ts` 的 `notes-file://`），新协议要 `registerSchemesAsPrivileged`（app ready 前）+ 更新 renderer/index.html 的 CSP。
- **手拼 HTML**（如 marked 自定义 renderer）：插值一律转义 + src/href 走 scheme 白名单。
- **i18n**：壳层文案进 `packages/ui/src/i18n.ts` 的 dict（zh/en 都要）；工具名/描述放 meta.ts。
- **样式**：无 UI 框架，用 styles.scss 的 CSS 变量（--bg/--bg-soft/--bg-hover/--fg/--fg-dim/--border/--accent/--danger）适配明暗双主题；图标用 emoji。
- **git 提交**：信息用中文、约定式前缀（feat/fix/docs/...），不带 Co-Authored-By。

## 文档

- 设计文档：`docs/superpowers/specs/`，实现计划：`docs/superpowers/plans/`
- 踩坑速查：`docs/踩坑与要点.md`（解决问题后追加要点，全局约定）
