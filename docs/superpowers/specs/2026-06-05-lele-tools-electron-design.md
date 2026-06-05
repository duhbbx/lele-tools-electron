# lele-tools-electron 设计文档

日期：2026-06-05
状态：已与 owner 确认

## 一句话

把 Qt 版 lele-tools（乐乐的工具箱）重写为 Electron 桌面应用：左侧功能导航栏 + 右侧多 Tab 工作区 + 全局 AI 助手，骨架与 AI 模块从 db-tool (SkylerX) 搬运适配，开源、跨平台（Windows / macOS / Linux）。

## 实现路线

新建干净 monorepo，按文件从 db-tool 搬运（**不是** fork 后做减法）：

- 骨架配置几乎原样拷：`pnpm-workspace.yaml`、`tsconfig.base.json`、`biome.json`、`vitest.config.ts`、`electron.vite.config.ts`、`electron-builder.yml`。
- AI / i18n / Monaco / settings 按文件搬，剥掉 `DbDialect` 等数据库耦合。
- UI 壳（导航、Tab、工作区）重写——db-tool 的 `Workspace.vue` / `QueryTabs.vue` 是数据库语义，不搬。
- 版权头：不带斯凯勒公司头，License 用 MIT（与 Qt 版 lele-tools 一致），作者 duhbbx。

## 仓库结构

```
lele-tools-electron/
├── apps/
│   ├── desktop/              # electron-vite：src/main + src/preload + src/renderer
│   └── website/              # VitePress 官网（中文根 + en/es/fr/ja/ko/pt）
├── packages/
│   ├── ui/                   # 全部界面与工具实现
│   └── shared-types/         # IPC 契约类型
├── docs/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
└── vitest.config.ts
```

## 工具注册机制（核心设计）

每个工具一个文件夹 `packages/ui/src/tools/<tool-id>/`：

- `meta.ts`：id、i18n 名称、分类、图标、搜索关键词。
- `Tool.vue`：工具界面，经 `defineAsyncComponent` 懒加载。

`tools/index.ts` 汇总成 `ToolRegistry`，导航栏与 Tab 系统只依赖 registry。**加新工具 = 加一个文件夹 + 注册一行。**

## 应用布局

- **左侧导航栏**：按分类分组列出工具，顶部搜索过滤，"最近使用"区块；可折叠。
- **右侧 Tab 区**：点工具开 Tab，多开、可关闭、可重排；`<KeepAlive>` 保持各工具状态。
- **全局 AI 助手面板**：右侧可收起。搬 db-tool 的 `AiChatPanel.vue`，系统提示词改为"工具箱助手"，注入"当前工具上下文"（当前激活 Tab 的工具名/输入摘要）。
- **设置对话框**：AI provider、语言、主题（明/暗），搬 db-tool `SettingsDialog.vue` 对应部分。

## AI 模块（从 db-tool 整体搬运）

三层结构原样保留：

1. 主进程 `src/main/ipc/ai.ts`：`ai:fetch` / `ai:stream` / `ai:cancel`，用 Node fetch 代理绕浏览器 CORS。
2. 渲染层 `ai.ts`：多 provider 客户端（anthropic / openai / deepseek / codex / grok / ollama），SSE 解析、流式、取消。
3. `AiChatPanel.vue` + `settings.ts` 的 `AiProvider` 配置段。

搬运时剥掉 SQL/schema 相关 prompt（`ai-prompts.ts` 重写为工具箱语境）。

## 首批 15 个工具（全纯前端）

| 分类 | 工具 |
|------|------|
| 编码 & 格式化 | JSON 格式化、XML 格式化、YAML 格式化（Monaco）、Base64 编解码、进制转换 |
| 文本 | 正则测试、字符统计、文本加解密 |
| 生成器 | UUID、随机密码、二维码 |
| 时间 | 日期时间/时间戳、Cron 表达式 |
| 其他 | 颜色工具、HTTP 状态码表 |

后续批次（Node 系统工具：文件哈希、Hosts 编辑、Ping、端口扫描等）按同一 registry 模板增量加。

## 数据持久化（better-sqlite3）

主进程单库，位于 `app.getPath('userData')/lele.db`：

- `settings`：键值对（AI provider 配置、语言、主题）。
- `recent_tools`：最近使用记录。
- `ai_chats`：AI 对话历史。

渲染层经 `window.api.store` IPC 读写。第一版就接上，后续记事本 / Todo 等有状态工具直接复用。

## i18n / 主题

- 应用内：搬 db-tool `i18n.ts`（中英双语）+ Monaco 中文 NLS（`monaco-setup.ts`、`monaco-nls*.ts`、`vendor/monaco-nls-*`）。
- 明暗主题，CSS 变量方案对齐 db-tool。

## 官网（apps/website）

- VitePress，结构照搬 db-tool：中文根 + en/es/fr/ja/ko/pt 共 7 语，`.vitepress/i18n.ts` 机制照搬。
- 页面：首页、功能一览（工具清单）、下载、文档（快速上手 / FAQ）、Roadmap。内容以 Qt 版 `lele-tools/website` 现有中文文案为底稿改写，再翻译 6 语。
- **部署**：`deploy.sh` 照搬适配（rsync + 服务器侧 chown www-data + chmod + nginx reload + IndexNow），env 前缀改 `LELE_DEPLOY_*`，`.env.deploy` gitignored。
- **域名 `lele.skyler.uno`**，与 Qt 版 `lele-tools.skyler.uno` 共存。一次性服务器准备（共享机 101.132.20.134，**只新增、不动现有配置**）：
  1. DNS 加 A 记录 `lele.skyler.uno → 101.132.20.134`。
  2. 新增独立 nginx server block + webroot（如 `/var/www/lele`）。
  3. certbot 签发 SSL。

## 构建 / 发布

- 版本对齐 db-tool（本机已验证可编译）：Electron 34、Vue 3.5、Vite 6、TS 5.7、Monaco 0.52、better-sqlite3 11、electron-builder 25。
- 本机编译原生模块 node-gyp 用 python3.9。
- 产物：Windows zip/nsis、macOS dmg+zip、Linux deb/rpm/AppImage。
- GitHub Actions 三平台构建（参考 db-tool 的 workflow），首版先保证本地 `pnpm dist` 可出包。
- Git 流：日常 `dev` 分支，`main` 只接 ff merge；commit message 英文、不带 Co-Authored-By。

## 测试

- 纯函数工具逻辑（格式化、进制转换、cron 解析、密码生成等）配 vitest 单测。
- AI 客户端搬运时保留 db-tool 已有的 `ai.test.ts` 可迁移部分。
- UI 手动验证。

## 不做（YAGNI）

- 不做 web 端工具箱（monorepo 结构已留扩展位，但首版不建）。
- 不做自动更新（electron-updater 后续版本再接）。
- 不做插件系统；registry 机制本身就是内置扩展点。
