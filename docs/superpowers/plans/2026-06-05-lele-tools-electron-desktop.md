# lele-tools-electron 桌面端实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭起 lele-tools-electron 桌面端：monorepo 骨架 + 左导航/右 Tab 壳 + AI 助手（从 db-tool 搬运）+ better-sqlite3 持久化 + 首批 15 个纯前端工具。

**Architecture:** pnpm monorepo（`apps/desktop` electron-vite 三段式 + `packages/ui` TS 源码包 + `packages/shared-types` IPC 契约）。UI 包以源码形式被 desktop 直接消费（vite `optimizeDeps.exclude`），无构建步骤。每个工具 = `packages/ui/src/tools/<id>/`（`meta.ts` + `Tool.vue`），registry 集中注册。AI 三层：主进程 fetch/stream 代理（绕 CORS）→ 渲染层多 provider 客户端 → 聊天面板。

**Tech Stack:** Electron 34 / Vue 3.5 / Vite 6 / electron-vite 3 / TS 5.7 / SCSS / Monaco 0.52 / better-sqlite3 11 / biome / vitest。

**搬运源（绝对路径）：**
- 骨架与 AI：`/Users/a9/Projects/db-tool`（下称 **DB**）
- 工具语义参考：`/Users/a9/Projects/lele-tools`（Qt 版，下称 **QT**）

**搬运通则（适用于所有"copy from DB"步骤）：**
1. 删掉文件头的 `Copyright 2026 武汉斯凯勒网络科技有限公司...` 注释块（本项目 MIT，不带公司头）。
2. `@db-tool/` → `@lele/`，`SkylerX/skylerx` → `Lele Tools/lele`。
3. 改完跑 `pnpm typecheck`，按报错删掉悬空 import。

**官网（apps/website）不在本计划内**——桌面端跑通后另起一份计划（VitePress 7 语 + lele.skyler.uno 部署）。

**本机注意：** 原生模块编译 node-gyp 要用 python3.9（`export PYTHON=python3.9`）；访问 localhost 的 curl 要 `--noproxy '*'`。

---

### Task 1: monorepo 根骨架

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `LICENSE`, `README.md`
- Copy: DB `tsconfig.base.json`, DB `biome.json`, DB `vitest.config.ts`

- [ ] **Step 1: 写根 package.json**

```json
{
  "name": "lele-tools-electron",
  "version": "0.1.0",
  "private": true,
  "description": "乐乐的工具箱 — Electron 版跨平台开发者工具集",
  "packageManager": "pnpm@10.26.2",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "pnpm --filter @lele/desktop dev",
    "build": "pnpm --filter @lele/desktop build",
    "dist": "pnpm --filter @lele/desktop dist",
    "typecheck": "pnpm -r typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome lint .",
    "format": "biome format --write ."
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["electron", "esbuild", "better-sqlite3"]
  }
}
```

- [ ] **Step 2: 写 pnpm-workspace.yaml**

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 3: 拷贝共享配置**

```bash
cd /Users/a9/Projects/lele-tools-electron
cp /Users/a9/Projects/db-tool/tsconfig.base.json .
cp /Users/a9/Projects/db-tool/biome.json .
cp /Users/a9/Projects/db-tool/vitest.config.ts .
grep -n "db-tool\|skylerx\|SkylerX" tsconfig.base.json biome.json vitest.config.ts
```

按 grep 结果把 `@db-tool` 路径别名/包名引用改成 `@lele`；vitest.config.ts 里若有 `apps/desktop`、`packages/**` 之外的 include（如 e2e）删掉。

- [ ] **Step 4: 写 .gitignore**

```
node_modules/
dist/
out/
release/
*.local
.DS_Store
.env.deploy
.vitepress/dist/
.vitepress/cache/
```

- [ ] **Step 5: 写 LICENSE（MIT）**

标准 MIT 文本，版权行：`Copyright (c) 2026 duhbbx`。可直接拷 QT 版：`cp /Users/a9/Projects/lele-tools/LICENSE .`

- [ ] **Step 6: 写 README.md 占位最小版**

```markdown
# lele-tools-electron — 乐乐的工具箱 (Electron)

Qt 版 [lele-tools](https://github.com/duhbbx/lele-tools) 的 Electron 重写：Vue3 + Vite + TS + Monaco + better-sqlite3，内置 AI 助手。开发中。

## 开发

​```bash
pnpm install
pnpm dev
​```
```

- [ ] **Step 7: 验证 + 提交**

```bash
pnpm install   # 应无报错（此时还没有子包，装根 devDeps）
git add -A && git commit -m "chore: monorepo scaffold (pnpm workspace, biome, vitest, tsconfig)"
```

---

### Task 2: shared-types 包（IPC 契约）

**Files:**
- Create: `packages/shared-types/package.json`, `packages/shared-types/tsconfig.json`, `packages/shared-types/src/index.ts`

- [ ] **Step 1: package.json + tsconfig**

```bash
mkdir -p packages/shared-types/src
cp /Users/a9/Projects/db-tool/packages/shared-types/tsconfig.json packages/shared-types/
```

`packages/shared-types/package.json`：

```json
{
  "name": "@lele/shared-types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./src/index.ts", "import": "./src/index.ts" } },
  "scripts": { "typecheck": "tsc -p tsconfig.json --noEmit" },
  "devDependencies": { "typescript": "^5.7.3" }
}
```

- [ ] **Step 2: src/index.ts — 完整契约**

```ts
/** 渲染层 ↔ 主进程 IPC 契约。preload 实现 window.api，renderer 按此消费。 */

export interface AiFetchRequest {
  url: string
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  /** 字符串 body；调用方负责 JSON.stringify */
  body?: string
  /** 毫秒超时，缺省 60s（流式 120s） */
  timeoutMs?: number
  reqId?: string
}

export interface AiFetchResponse {
  ok: boolean
  status: number
  body: string
  error?: string
}

export interface AiBridge {
  fetch(req: AiFetchRequest): Promise<AiFetchResponse>
  cancel(reqId: string): Promise<boolean>
  stream(
    req: AiFetchRequest & { reqId: string },
    onChunk: (p: { chunk: string }) => void,
  ): Promise<{ ok: boolean; status: number; error?: string }>
}

export interface StoreBridge {
  /** 设置 kv：value 为 JSON 字符串 */
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

export interface RecentsBridge {
  /** 按 last_used 倒序返回 tool id */
  list(limit?: number): Promise<string[]>
  touch(toolId: string): Promise<void>
}

export interface ChatMessageRow {
  id: number
  role: 'user' | 'assistant'
  content: string
  ts: number
}

export interface ChatsBridge {
  list(): Promise<ChatMessageRow[]>
  append(role: 'user' | 'assistant', content: string): Promise<void>
  clear(): Promise<void>
}

export interface WindowApi {
  ai: AiBridge
  store: StoreBridge
  recents: RecentsBridge
  chats: ChatsBridge
}
```

- [ ] **Step 3: 验证 + 提交**

```bash
pnpm install && pnpm --filter @lele/shared-types typecheck
git add -A && git commit -m "feat: shared-types package with IPC contract"
```

---

### Task 3: ui 包外壳（i18n / 样式 / registry）

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/index.ts`, `packages/ui/src/i18n.ts`, `packages/ui/src/styles.scss`, `packages/ui/src/registry.ts`, `packages/ui/src/tools/index.ts`, `packages/ui/src/Workspace.vue`(占位), `packages/ui/src/env.d.ts`

- [ ] **Step 1: package.json + tsconfig**

```bash
mkdir -p packages/ui/src/tools packages/ui/src/components packages/ui/src/vendor
cp /Users/a9/Projects/db-tool/packages/ui/tsconfig.json packages/ui/
cp /Users/a9/Projects/db-tool/packages/ui/src/env.d.ts packages/ui/src/ 2>/dev/null || true
```

若 env.d.ts 不存在或含 db 专属声明，写成：

```ts
/// <reference types="vite/client" />
import type { WindowApi } from '@lele/shared-types'

declare global {
  interface Window {
    api: WindowApi
  }
}
export {}
```

`packages/ui/package.json`：

```json
{
  "name": "@lele/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Lele Tools 共享 UI（Vue 组件 + 工具实现）",
  "exports": {
    ".": "./src/index.ts",
    "./styles.scss": "./src/styles.scss",
    "./monaco-nls": "./src/monaco-nls.ts"
  },
  "scripts": {
    "typecheck": "vue-tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@lele/shared-types": "workspace:*",
    "cron-parser": "^4.9.0",
    "marked": "^18.0.4",
    "monaco-editor": "^0.52.2",
    "qrcode": "^1.5.4",
    "yaml": "^2.6.0"
  },
  "devDependencies": {
    "@types/qrcode": "^1.5.5",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5",
    "vue": "^3.5.13",
    "vue-tsc": "^2.2.0"
  }
}
```

tsconfig.json 里 `@db-tool` 引用改 `@lele`。

- [ ] **Step 2: i18n.ts（机制照 DB，字典全新）**

```ts
import { ref } from 'vue'

export type Locale = 'zh' | 'en'
export const LOCALE_LABEL: Record<Locale, string> = { zh: '简体中文', en: 'English' }

export const locale = ref<Locale>('zh')
export function setLocale(l: Locale): void {
  locale.value = l
}

/** 壳层文案字典；工具名/描述不在这里（见 registry.ts ToolMeta.name）。 */
const dict: Record<string, Record<Locale, string>> = {
  'app.title': { zh: '乐乐的工具箱', en: 'Lele Tools' },
  'nav.search': { zh: '搜索工具…', en: 'Search tools…' },
  'nav.recent': { zh: '最近使用', en: 'Recent' },
  'welcome.hint': { zh: '从左侧选择一个工具开始', en: 'Pick a tool from the sidebar to start' },
  'tabs.close': { zh: '关闭', en: 'Close' },
  'settings.title': { zh: '设置', en: 'Settings' },
  'settings.language': { zh: '语言', en: 'Language' },
  'settings.theme': { zh: '主题', en: 'Theme' },
  'settings.theme.dark': { zh: '深色', en: 'Dark' },
  'settings.theme.light': { zh: '浅色', en: 'Light' },
  'settings.theme.system': { zh: '跟随系统', en: 'System' },
  'settings.ai': { zh: 'AI 助手', en: 'AI Assistant' },
  'settings.ai.provider': { zh: '服务商', en: 'Provider' },
  'settings.ai.apiKey': { zh: 'API Key', en: 'API Key' },
  'settings.ai.model': { zh: '模型', en: 'Model' },
  'settings.ai.baseUrl': { zh: 'Base URL', en: 'Base URL' },
  'settings.ai.test': { zh: '测试连接', en: 'Test connection' },
  'settings.ai.testOk': { zh: '连接成功', en: 'Connected' },
  'common.close': { zh: '关闭', en: 'Close' },
  'common.copy': { zh: '复制', en: 'Copy' },
  'common.copied': { zh: '已复制', en: 'Copied' },
  'common.clear': { zh: '清空', en: 'Clear' },
  'ai.title': { zh: 'AI 助手', en: 'AI Assistant' },
  'ai.placeholder': { zh: '问点什么…（Enter 发送，Shift+Enter 换行）', en: 'Ask anything… (Enter to send)' },
  'ai.send': { zh: '发送', en: 'Send' },
  'ai.stop': { zh: '停止', en: 'Stop' },
  'ai.notConfigured': { zh: '先在设置里配置 AI 服务商', en: 'Configure an AI provider in Settings first' },
}

export function t(key: string): string {
  return dict[key]?.[locale.value] ?? key
}
```

- [ ] **Step 3: styles.scss（主题变量 + 基础类）**

```scss
:root,
:root[data-theme='dark'] {
  --bg: #1e1f24;
  --bg-soft: #26272e;
  --bg-hover: #31333c;
  --fg: #e6e6eb;
  --fg-dim: #9a9aa5;
  --border: #3a3b44;
  --accent: #5b8def;
  --accent-fg: #fff;
  --danger: #e5604c;
  color-scheme: dark;
}

:root[data-theme='light'] {
  --bg: #f7f7f9;
  --bg-soft: #ffffff;
  --bg-hover: #ececf1;
  --fg: #2b2b33;
  --fg-dim: #71717c;
  --border: #d9d9e0;
  --accent: #3b6fd4;
  --accent-fg: #fff;
  --danger: #c94a38;
  color-scheme: light;
}

* { box-sizing: border-box; }
html, body, #app { height: 100%; margin: 0; }
body {
  background: var(--bg);
  color: var(--fg);
  font: 13px/1.6 -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif;
}

.btn {
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-soft);
  color: var(--fg);
  cursor: pointer;
  &:hover { background: var(--bg-hover); }
  &.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
  &:disabled { opacity: 0.5; cursor: default; }
}

.input, .select, .textarea {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-soft);
  color: var(--fg);
  outline: none;
  &:focus { border-color: var(--accent); }
}
.textarea { resize: vertical; font-family: ui-monospace, Menlo, Consolas, monospace; }

.tool-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  overflow: auto;
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .grow { flex: 1; }
  .hint { color: var(--fg-dim); font-size: 12px; }
  .error { color: var(--danger); font-size: 12px; white-space: pre-wrap; }
}
```

- [ ] **Step 4: registry.ts**

```ts
import type { Component } from 'vue'
import type { Locale } from './i18n'

export type ToolCategory = 'format' | 'text' | 'generator' | 'time' | 'misc'

export const CATEGORY_ORDER: ToolCategory[] = ['format', 'text', 'generator', 'time', 'misc']

export const CATEGORY_LABEL: Record<ToolCategory, Record<Locale, string>> = {
  format: { zh: '编码 & 格式化', en: 'Encode & Format' },
  text: { zh: '文本', en: 'Text' },
  generator: { zh: '生成器', en: 'Generators' },
  time: { zh: '时间', en: 'Time' },
  misc: { zh: '其他', en: 'Misc' },
}

export interface ToolMeta {
  id: string
  name: Record<Locale, string>
  desc: Record<Locale, string>
  category: ToolCategory
  /** 搜索关键词（中英拼都放这里） */
  keywords: string[]
  /** emoji 图标，后续可换 SVG */
  icon: string
  load: () => Promise<{ default: Component }>
}
```

- [ ] **Step 5: tools/index.ts（空 registry）+ Workspace 占位 + index.ts**

`src/clipboard.ts`（Vue 模板表达式访问不到 `navigator` 全局，所有工具的「复制」按钮统一 import 这个助手）：

```ts
export function copyText(s: string): void {
  void navigator.clipboard.writeText(s)
}
```

`src/tools/index.ts`：

```ts
import type { ToolMeta } from '../registry'

export const TOOLS: ToolMeta[] = []

export function toolById(id: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.id === id)
}
```

`src/Workspace.vue`（Task 7 会重写）：

```vue
<script setup lang="ts">
import { t } from './i18n'
</script>

<template>
  <div style="display: grid; place-items: center; height: 100%">
    <p>{{ t('app.title') }} 🚧</p>
  </div>
</template>
```

`src/index.ts`：

```ts
export { default as Workspace } from './Workspace.vue'
export { type Locale, LOCALE_LABEL, locale, setLocale, t } from './i18n'
export { TOOLS, toolById } from './tools'
export { CATEGORY_LABEL, CATEGORY_ORDER, type ToolCategory, type ToolMeta } from './registry'
```

- [ ] **Step 6: 验证 + 提交**

```bash
pnpm install && pnpm --filter @lele/ui typecheck
git add -A && git commit -m "feat: ui package shell (i18n, theme styles, tool registry)"
```

---

### Task 4: desktop 应用启动（空窗口渲染 Workspace）

**Files:**
- Create: `apps/desktop/package.json`, `apps/desktop/electron.vite.config.ts`, `apps/desktop/tsconfig.node.json`, `apps/desktop/tsconfig.web.json`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/preload/index.ts`, `apps/desktop/src/renderer/index.html`, `apps/desktop/src/renderer/src/main.ts`, `apps/desktop/src/renderer/src/App.vue`, `apps/desktop/src/renderer/src/env.d.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@lele/desktop",
  "version": "0.1.0",
  "private": true,
  "description": "乐乐的工具箱 - 桌面端 (Electron + Vue3)",
  "main": "./out/main/index.js",
  "author": { "name": "duhbbx", "email": "duhbbx@gmail.com" },
  "homepage": "https://github.com/duhbbx/lele-tools-electron",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "pnpm typecheck && electron-vite build",
    "pack": "pnpm build && electron-builder --dir",
    "dist": "pnpm build && electron-builder",
    "rebuild:native": "electron-builder install-app-deps",
    "typecheck:node": "tsc --noEmit -p tsconfig.node.json",
    "typecheck:web": "vue-tsc --noEmit -p tsconfig.web.json",
    "typecheck": "pnpm typecheck:node && pnpm typecheck:web"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1"
  },
  "devDependencies": {
    "@lele/shared-types": "workspace:*",
    "@lele/ui": "workspace:*",
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.10.7",
    "@vitejs/plugin-vue": "^5.2.1",
    "electron": "34.2.0",
    "electron-builder": "^25.1.8",
    "electron-vite": "^3.1.0",
    "monaco-editor": "^0.52.2",
    "sass": "^1.80.0",
    "typescript": "^5.7.3",
    "vite": "^6.0.11",
    "vue": "^3.5.13",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 2: electron.vite.config.ts（DB 改版，monaco NLS shim 保留）**

```ts
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'

// 工作区 TS 源码包打进产物；better-sqlite3 等原生模块保持 external。
const workspacePkgs = ['@lele/shared-types']

const NLS_SHIM = resolve(__dirname, '../../packages/ui/src/vendor/monaco-nls-shim.ts')

/**
 * Monaco 国际化拦截：把 monaco-editor/esm/vs/nls.js 整体换成我们的 shim。
 * 必须用 resolveId 插件 + 绝对路径终态匹配（resolve.alias 截不到 monaco 内部的相对引用），
 * 且 monaco-editor 要从 optimizeDeps 排除。详见 docs/踩坑与要点.md。
 */
function monacoNlsShim(): Plugin {
  let hits = 0
  return {
    name: 'lele:monaco-nls-shim',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (source === 'monaco-editor/esm/vs/nls.js' || source === 'monaco-editor/esm/vs/nls') {
        hits++
        return NLS_SHIM
      }
      if (importer && /[\\/]monaco-editor[\\/]/.test(importer) && /(^|[\\/])nls(\.js)?$/.test(source)) {
        const r = await this.resolve(source, importer, { skipSelf: true })
        if (!r?.id) return null
        const pathOnly = r.id.split('?')[0]
        if (/[\\/]monaco-editor[\\/]esm[\\/]vs[\\/]nls\.js$/.test(pathOnly)) {
          hits++
          if (hits <= 3) console.log(`[monacoNlsShim] redirected ${hits} → ${NLS_SHIM}`)
          return NLS_SHIM
        }
      }
      return null
    },
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePkgs })],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: { '@renderer': resolve('src/renderer/src') },
    },
    optimizeDeps: { exclude: ['@lele/ui', 'monaco-editor'] },
    plugins: [monacoNlsShim(), vue()],
  },
})
```

- [ ] **Step 3: tsconfig 两份**

```bash
cp /Users/a9/Projects/db-tool/apps/desktop/tsconfig.node.json apps/desktop/
cp /Users/a9/Projects/db-tool/apps/desktop/tsconfig.web.json apps/desktop/
grep -n "db-tool" apps/desktop/tsconfig.*.json
```

`@db-tool` → `@lele`；include 路径里 db 专属目录（如 `src/main/db` 之外的）保持原样即可，多余 include 不报错。

- [ ] **Step 4: 主进程 src/main/index.ts**

```ts
import { join } from 'node:path'
import { BrowserWindow, app, shell } from 'electron'

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    title: isDev ? '[DEV] 乐乐的工具箱' : '乐乐的工具箱',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.on('ready-to-show', () => win.show())
  // 外链一律走系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (isDev && rendererUrl) void win.loadURL(rendererUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 5: preload 占位 + renderer 三件**

`src/preload/index.ts`：

```ts
import { contextBridge } from 'electron'

// Task 5 / Task 9 往这里加 store / ai 桥
const api = {}

contextBridge.exposeInMainWorld('api', api)
```

`src/renderer/index.html`：

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>乐乐的工具箱</title>
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:"
    />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./src/main.ts"></script>
  </body>
</html>
```

`src/renderer/src/main.ts`：

```ts
import '@lele/ui/styles.scss'
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

`src/renderer/src/App.vue`：

```vue
<script setup lang="ts">
import { Workspace } from '@lele/ui'
</script>

<template>
  <Workspace />
</template>
```

`src/renderer/src/env.d.ts`：

```ts
/// <reference types="vite/client" />
import type { WindowApi } from '@lele/shared-types'

declare global {
  interface Window {
    api: WindowApi
  }
}
export {}
```

- [ ] **Step 6: 验证 + 提交**

```bash
pnpm install
pnpm --filter @lele/desktop typecheck
pnpm dev   # 应弹出窗口，显示「乐乐的工具箱 🚧」，无 console 报错；Ctrl+C 退出
git add -A && git commit -m "feat: desktop app boots with electron-vite + ui workspace"
```

如 better-sqlite3 编译失败：`export PYTHON=python3.9 && pnpm rebuild:native`。

---

### Task 5: 主进程 sqlite store + preload 桥

**Files:**
- Create: `apps/desktop/src/main/db/sqlite.ts`(改自 DB), `apps/desktop/src/main/db/schema.ts`, `apps/desktop/src/main/db/stores.ts`, `apps/desktop/src/main/ipc/store.ts`
- Modify: `apps/desktop/src/main/index.ts`, `apps/desktop/src/preload/index.ts`

- [ ] **Step 1: 拷 sqlite.ts 并适配**

```bash
mkdir -p apps/desktop/src/main/db apps/desktop/src/main/ipc
cp /Users/a9/Projects/db-tool/apps/desktop/src/main/db/sqlite.ts apps/desktop/src/main/db/
```

打开适配：删公司头；db 文件名改 `lele.db`；它 import 的 `schema.ts` 由下一步提供（保持 `migrate(db)` 同名导出，对不上就以我们 schema.ts 的导出名为准改 sqlite.ts）。

- [ ] **Step 2: schema.ts**

```ts
import type Database from 'better-sqlite3'

export function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recent_tools (
      tool_id   TEXT PRIMARY KEY,
      last_used INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_chats (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      role    TEXT NOT NULL,
      content TEXT NOT NULL,
      ts      INTEGER NOT NULL
    );
  `)
}
```

- [ ] **Step 3: stores.ts（三个 store 合一文件，都是薄封装）**

```ts
import type { ChatMessageRow } from '@lele/shared-types'
import { getDb } from './sqlite'

export const settingsStore = {
  get(key: string): string | null {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  },
  set(key: string, value: string): void {
    getDb()
      .prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  },
}

export const recentsStore = {
  list(limit = 8): string[] {
    const rows = getDb()
      .prepare('SELECT tool_id FROM recent_tools ORDER BY last_used DESC LIMIT ?')
      .all(limit) as { tool_id: string }[]
    return rows.map((r) => r.tool_id)
  },
  touch(toolId: string): void {
    getDb()
      .prepare(
        'INSERT INTO recent_tools(tool_id, last_used) VALUES(?, ?) ON CONFLICT(tool_id) DO UPDATE SET last_used = excluded.last_used',
      )
      .run(toolId, Date.now())
  },
}

export const chatsStore = {
  list(): ChatMessageRow[] {
    return getDb().prepare('SELECT id, role, content, ts FROM ai_chats ORDER BY id').all() as ChatMessageRow[]
  },
  append(role: 'user' | 'assistant', content: string): void {
    getDb().prepare('INSERT INTO ai_chats(role, content, ts) VALUES(?, ?, ?)').run(role, content, Date.now())
  },
  clear(): void {
    getDb().prepare('DELETE FROM ai_chats').run()
  },
}
```

注意：`getDb` 的实际导出名以拷来的 sqlite.ts 为准（DB 版可能叫 `openDb`/`db()`），对齐即可。

- [ ] **Step 4: ipc/store.ts**

```ts
import { ipcMain } from 'electron'
import { chatsStore, recentsStore, settingsStore } from '../db/stores'

export function registerStoreIpc(): void {
  ipcMain.handle('store:get', (_e, key: string) => settingsStore.get(key))
  ipcMain.handle('store:set', (_e, key: string, value: string) => settingsStore.set(key, value))
  ipcMain.handle('recents:list', (_e, limit?: number) => recentsStore.list(limit))
  ipcMain.handle('recents:touch', (_e, toolId: string) => recentsStore.touch(toolId))
  ipcMain.handle('chats:list', () => chatsStore.list())
  ipcMain.handle('chats:append', (_e, role: 'user' | 'assistant', content: string) =>
    chatsStore.append(role, content),
  )
  ipcMain.handle('chats:clear', () => chatsStore.clear())
}
```

- [ ] **Step 5: 接进 main/index.ts**

`import { registerStoreIpc } from './ipc/store'`，并在 `app.whenReady().then(() => {` 里 `createWindow()` 之前加 `registerStoreIpc()`。`window-all-closed` 里 quit 前调用 sqlite.ts 的 close 导出（以实际导出名为准）。

- [ ] **Step 6: preload 桥**

`src/preload/index.ts` 全量替换：

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { WindowApi } from '@lele/shared-types'

const api: Pick<WindowApi, 'store' | 'recents' | 'chats'> = {
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
  },
  recents: {
    list: (limit) => ipcRenderer.invoke('recents:list', limit),
    touch: (toolId) => ipcRenderer.invoke('recents:touch', toolId),
  },
  chats: {
    list: () => ipcRenderer.invoke('chats:list'),
    append: (role, content) => ipcRenderer.invoke('chats:append', role, content),
    clear: () => ipcRenderer.invoke('chats:clear'),
  },
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 7: 验证 + 提交**

```bash
pnpm dev
# DevTools Console:
#   await window.api.store.set('probe', '"hi"'); await window.api.store.get('probe')  → '"hi"'
#   await window.api.recents.touch('json-formatter'); await window.api.recents.list() → ['json-formatter']
# 重启 pnpm dev 后 get('probe') 仍是 '"hi"'（落了盘）
git add -A && git commit -m "feat: sqlite-backed store (settings/recents/chats) with IPC bridge"
```

---

### Task 6: 渲染层 settings.ts（双层持久化）+ 主题

**Files:**
- Create: `packages/ui/src/settings.ts`
- Modify: `packages/ui/src/index.ts`, `apps/desktop/src/renderer/src/main.ts`

- [ ] **Step 1: settings.ts 完整实现**

AiProvider 块照 DB `packages/ui/src/settings.ts` L8-61 原文（下面已含）；持久化用「localStorage 缓存 + SQLite 真源」双层（DB 同款思路，简化版）：

```ts
import { reactive, ref, watch } from 'vue'
import type { Locale } from './i18n'
import { locale } from './i18n'

/** AI 后端 provider 标识；anthropic 用 Messages API，其余走 OpenAI 兼容的 chat/completions。 */
export type AiProvider = 'anthropic' | 'openai' | 'deepseek' | 'codex' | 'grok' | 'ollama'

/** 本地 provider：不需要 API Key（Ollama 等本机推理服务）。 */
export const LOCAL_AI_PROVIDERS: ReadonlySet<AiProvider> = new Set<AiProvider>(['ollama'])
export function isLocalAiProvider(p: AiProvider): boolean {
  return LOCAL_AI_PROVIDERS.has(p)
}

export interface AiProviderConfig {
  apiKey: string
  model: string
  baseUrl: string
}

export const AI_PROVIDER_LABEL: Record<AiProvider, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'ChatGPT (OpenAI)',
  deepseek: 'DeepSeek',
  codex: 'Codex (OpenAI 兼容)',
  grok: 'Grok (xAI)',
  ollama: 'Ollama (本地 / Local)',
}

export const AI_PROVIDER_ORDER: AiProvider[] = ['anthropic', 'openai', 'deepseek', 'codex', 'grok', 'ollama']

export const AI_PROVIDER_DEFAULTS: Record<AiProvider, AiProviderConfig> = {
  anthropic: { apiKey: '', model: 'claude-sonnet-4-6', baseUrl: 'https://api.anthropic.com' },
  openai: { apiKey: '', model: 'gpt-4o', baseUrl: 'https://api.openai.com' },
  deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com' },
  codex: { apiKey: '', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com' },
  grok: { apiKey: '', model: 'grok-2-latest', baseUrl: 'https://api.x.ai' },
  ollama: { apiKey: '', model: 'llama3.1', baseUrl: 'http://localhost:11434' },
}

export interface Settings {
  locale: Locale
  theme: 'dark' | 'light' | 'system'
  navWidth: number
  aiProvider: AiProvider
  aiProviders: Record<AiProvider, AiProviderConfig>
}

function defaults(): Settings {
  return {
    locale: 'zh',
    theme: 'system',
    navWidth: 240,
    aiProvider: 'deepseek',
    aiProviders: structuredClone(AI_PROVIDER_DEFAULTS),
  }
}

const KEY = 'lele.settings'

/** 同步读 localStorage：首屏 0ms 不闪默认值；SQLite 是真源，hydrate 后覆盖。 */
function load(): Settings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    if (!raw) return defaults()
    const saved = JSON.parse(raw) as Partial<Settings>
    const base = defaults()
    return {
      ...base,
      ...saved,
      aiProviders: { ...base.aiProviders, ...(saved.aiProviders ?? {}) },
    }
  } catch {
    return defaults()
  }
}

export const settings = reactive<Settings>(load())

/** 当前激活 provider 是否已配好（足以发请求）。本地 provider 只需 baseUrl。 */
export function isActiveAiConfigured(): boolean {
  const p = settings.aiProvider
  const cfg = settings.aiProviders[p]
  if (!cfg?.baseUrl?.trim()) return false
  return isLocalAiProvider(p) ? true : !!cfg.apiKey?.trim()
}

let hydrated = false
/** 启动后从 SQLite 拉真源；SQLite 为空则把当前（localStorage/默认）推一份过去。 */
export async function hydrateSettings(): Promise<void> {
  const bridge = window.api?.store
  if (!bridge || hydrated) return
  hydrated = true
  try {
    const raw = await bridge.get(KEY)
    if (raw) Object.assign(settings, { ...settings, ...(JSON.parse(raw) as Partial<Settings>) })
    else await bridge.set(KEY, JSON.stringify(settings))
  } catch (e) {
    console.warn('[settings] hydrate failed', e)
  }
}

watch(
  settings,
  () => {
    const json = JSON.stringify(settings)
    try {
      localStorage.setItem(KEY, json)
    } catch {}
    void window.api?.store?.set(KEY, json)
    if (settings.locale !== locale.value) locale.value = settings.locale
    applyTheme()
  },
  { deep: true },
)

// ── 主题 ──
export const resolvedTheme = ref<'dark' | 'light'>('dark')
const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null
media?.addEventListener('change', () => applyTheme())

export function applyTheme(): void {
  const mode = settings.theme === 'system' ? (media?.matches !== false ? 'dark' : 'light') : settings.theme
  resolvedTheme.value = mode
  document.documentElement.dataset.theme = mode
}

/** 应用启动时调用一次：同步 locale + 主题 + 异步 hydrate。 */
export function initSettings(): void {
  locale.value = settings.locale
  applyTheme()
  void hydrateSettings()
}
```

- [ ] **Step 2: 导出 + 启动调用**

`packages/ui/src/index.ts` 追加：

```ts
export {
  AI_PROVIDER_DEFAULTS,
  AI_PROVIDER_LABEL,
  AI_PROVIDER_ORDER,
  type AiProvider,
  type AiProviderConfig,
  initSettings,
  isActiveAiConfigured,
  isLocalAiProvider,
  resolvedTheme,
  settings,
} from './settings'
```

`apps/desktop/src/renderer/src/main.ts` 在 mount 前：

```ts
import { initSettings } from '@lele/ui'
initSettings()
```

- [ ] **Step 3: 验证 + 提交**

```bash
pnpm dev
# Console: 修改主题并确认 <html data-theme> 变化 + 重启后保留：
#   const { settings } = await import('@lele/ui')  // 不行就临时在 App.vue console.log
# 更简单的验证：DevTools 里 document.documentElement.dataset.theme 应为 'dark' 或 'light'；
#   localStorage['lele.settings'] 存在；await window.api.store.get('lele.settings') 非空
git add -A && git commit -m "feat: renderer settings with dual persistence (localStorage cache + sqlite source)"
```

---

### Task 7: 壳层 UI（SideNav + ToolTabs + Workspace）

**Files:**
- Create: `packages/ui/src/components/SideNav.vue`, `packages/ui/src/components/ToolTabs.vue`
- Rewrite: `packages/ui/src/Workspace.vue`

- [ ] **Step 1: SideNav.vue**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../registry'
import { locale, t } from '../i18n'
import { TOOLS, toolById } from '../tools'

const emit = defineEmits<{ open: [toolId: string]; settings: [] }>()

const query = ref('')
const recents = ref<string[]>([])

onMounted(async () => {
  recents.value = (await window.api?.recents?.list?.(6)) ?? []
})
/** Workspace 打开工具后调用，刷新最近使用 */
async function refreshRecents(): Promise<void> {
  recents.value = (await window.api?.recents?.list?.(6)) ?? []
}
defineExpose({ refreshRecents })

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
    <div class="head">
      <span class="title">{{ t('app.title') }}</span>
      <button class="btn" :title="t('settings.title')" @click="emit('settings')">⚙</button>
    </div>
    <input v-model="query" class="input search" :placeholder="t('nav.search')" />
    <div class="scroll">
      <template v-if="!query && recents.length">
        <div class="cat">{{ t('nav.recent') }}</div>
        <button
          v-for="id in recents"
          :key="'r-' + id"
          class="item"
          @click="emit('open', id)"
        >
          <span class="icon">{{ toolById(id)?.icon }}</span>{{ toolById(id)?.name[locale] ?? id }}
        </button>
      </template>
      <template v-for="g in grouped" :key="g.cat">
        <div class="cat">{{ g.label }}</div>
        <button v-for="m in g.tools" :key="m.id" class="item" :title="m.desc[locale]" @click="emit('open', m.id)">
          <span class="icon">{{ m.icon }}</span>{{ m.name[locale] }}
        </button>
      </template>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.side-nav {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid var(--border);
  background: var(--bg-soft);
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 6px;
    .title { font-weight: 600; }
  }
  .search { margin: 4px 10px 8px; }
  .scroll { flex: 1; overflow-y: auto; padding-bottom: 10px; }
  .cat {
    padding: 8px 12px 4px;
    font-size: 11px;
    color: var(--fg-dim);
    text-transform: uppercase;
  }
  .item {
    display: block;
    width: 100%;
    padding: 5px 14px;
    border: 0;
    background: none;
    color: var(--fg);
    text-align: left;
    cursor: pointer;
    border-radius: 0;
    &:hover { background: var(--bg-hover); }
    .icon { display: inline-block; width: 22px; }
  }
}
</style>
```

- [ ] **Step 2: ToolTabs.vue**

```vue
<script setup lang="ts">
import { locale, t } from '../i18n'
import { toolById } from '../tools'

defineProps<{ tabs: string[]; active: string | null }>()
const emit = defineEmits<{ activate: [id: string]; close: [id: string] }>()
</script>

<template>
  <div class="tool-tabs">
    <div
      v-for="id in tabs"
      :key="id"
      class="tab"
      :class="{ active: id === active }"
      @click="emit('activate', id)"
      @click.middle="emit('close', id)"
    >
      <span>{{ toolById(id)?.icon }} {{ toolById(id)?.name[locale] ?? id }}</span>
      <button class="x" :title="t('tabs.close')" @click.stop="emit('close', id)">×</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tool-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 8px 0;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px 5px 12px;
    border: 1px solid var(--border);
    border-bottom: 0;
    border-radius: 8px 8px 0 0;
    background: var(--bg);
    cursor: pointer;
    white-space: nowrap;
    &.active { background: var(--bg-soft); border-color: var(--accent); }
    .x {
      border: 0;
      background: none;
      color: var(--fg-dim);
      cursor: pointer;
      font-size: 14px;
      &:hover { color: var(--danger); }
    }
  }
}
</style>
```

- [ ] **Step 3: Workspace.vue 重写**

打开过的工具组件全部保持挂载、`v-show` 切换（天然保留各工具内部状态，比 KeepAlive 省心）：

```vue
<script setup lang="ts">
import { type Component, ref, shallowRef } from 'vue'
import { t } from './i18n'
import { toolById } from './tools'
import SideNav from './components/SideNav.vue'
import ToolTabs from './components/ToolTabs.vue'

const tabs = ref<string[]>([])
const active = ref<string | null>(null)
/** toolId → 已加载的组件（异步 load 完成后填充） */
const comps = shallowRef<Record<string, Component>>({})
const navRef = ref<InstanceType<typeof SideNav>>()
const showSettings = ref(false)

async function open(id: string): Promise<void> {
  const meta = toolById(id)
  if (!meta) return
  if (!tabs.value.includes(id)) {
    if (!comps.value[id]) {
      const mod = await meta.load()
      comps.value = { ...comps.value, [id]: mod.default }
    }
    tabs.value = [...tabs.value, id]
  }
  active.value = id
  void window.api?.recents?.touch?.(id).then(() => navRef.value?.refreshRecents())
}

function close(id: string): void {
  tabs.value = tabs.value.filter((x) => x !== id)
  if (active.value === id) active.value = tabs.value[tabs.value.length - 1] ?? null
}
</script>

<template>
  <div class="workspace">
    <SideNav ref="navRef" @open="open" @settings="showSettings = true" />
    <div class="main">
      <ToolTabs :tabs="tabs" :active="active" @activate="active = $event" @close="close" />
      <div class="body">
        <div v-if="!tabs.length" class="welcome">{{ t('welcome.hint') }}</div>
        <div v-for="id in tabs" v-show="id === active" :key="id" class="pane">
          <component :is="comps[id]" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.workspace {
  display: grid;
  grid-template-columns: 240px 1fr;
  height: 100%;
  .main { display: flex; flex-direction: column; min-width: 0; }
  .body { flex: 1; min-height: 0; position: relative; }
  .pane { height: 100%; }
  .welcome {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--fg-dim);
  }
}
</style>
```

（`showSettings` 在 Task 8 接 SettingsDialog；本任务先留着，typecheck 会提示未使用——临时在模板里加 `<span v-if="false">{{ showSettings }}</span>` 或先不声明、Task 8 再加，二选一。）

- [ ] **Step 4: 验证 + 提交**

```bash
pnpm --filter @lele/ui typecheck && pnpm dev
# 窗口应显示左导航（暂无工具，只有搜索框）+ 欢迎语
git add -A && git commit -m "feat: workspace shell with side nav and tool tabs"
```

---

### Task 8: SettingsDialog（语言 + 主题）

**Files:**
- Create: `packages/ui/src/components/SettingsDialog.vue`
- Modify: `packages/ui/src/Workspace.vue`

- [ ] **Step 1: SettingsDialog.vue**

```vue
<script setup lang="ts">
import { LOCALE_LABEL, t } from '../i18n'
import { settings } from '../settings'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>{{ t('settings.title') }}</h3>
      <label class="field">
        <span>{{ t('settings.language') }}</span>
        <select v-model="settings.locale" class="select">
          <option value="zh">{{ LOCALE_LABEL.zh }}</option>
          <option value="en">{{ LOCALE_LABEL.en }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ t('settings.theme') }}</span>
        <select v-model="settings.theme" class="select">
          <option value="system">{{ t('settings.theme.system') }}</option>
          <option value="dark">{{ t('settings.theme.dark') }}</option>
          <option value="light">{{ t('settings.theme.light') }}</option>
        </select>
      </label>
      <!-- Task 10 在这里追加 AI provider 配置区 -->
      <div class="foot">
        <button class="btn" @click="emit('close')">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 45%);
  display: grid;
  place-items: center;
  z-index: 100;
}
.dialog {
  width: 460px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-soft);
  h3 { margin: 0 0 14px; }
  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    > span { color: var(--fg-dim); }
  }
  .foot { display: flex; justify-content: flex-end; margin-top: 14px; }
}
</style>
```

- [ ] **Step 2: 接进 Workspace**

Workspace.vue：`import SettingsDialog from './components/SettingsDialog.vue'`，模板根 `.workspace` 末尾加：

```html
<SettingsDialog :open="showSettings" @close="showSettings = false" />
```

- [ ] **Step 3: 验证 + 提交**

```bash
pnpm dev
# 点 ⚙ 打开设置：切语言 → 导航标题立刻变 Lele Tools；切主题 → 配色立刻变；重启后均保留
git add -A && git commit -m "feat: settings dialog (locale + theme)"
```

---

### Task 9: AI 三层搬运（主进程代理 + 渲染层客户端）

**Files:**
- Copy: DB `apps/desktop/src/main/ipc/ai.ts` → `apps/desktop/src/main/ipc/ai.ts`
- Copy: DB `packages/ui/src/ai.ts` → `packages/ui/src/ai.ts`（删改）
- Modify: `apps/desktop/src/main/index.ts`, `apps/desktop/src/preload/index.ts`, `packages/ui/src/index.ts`

- [ ] **Step 1: 主进程 ipc/ai.ts 原样拷**

```bash
cp /Users/a9/Projects/db-tool/apps/desktop/src/main/ipc/ai.ts apps/desktop/src/main/ipc/
```

只删公司头注释，其余不动（它零外部依赖，AiFetchRequest/Response 在文件内自带定义）。
main/index.ts：`import { registerAiIpc } from './ipc/ai'`，`registerStoreIpc()` 旁边加 `registerAiIpc()`。

- [ ] **Step 2: preload 加 ai 桥**

打开 DB `apps/desktop/src/preload/index.ts`，把其中 `ai: { ... }` 整个对象（约 L128-165：fetch / cancel / stream 三个方法，stream 含 `ai:stream:<reqId>` 频道订阅与退订逻辑）原样拷进我们的 `api` 对象，类型标注换成 `WindowApi['ai']`：

```ts
const api: WindowApi = {
  ai: {
    /* ←从 DB preload 拷来的 fetch/cancel/stream 三方法，逻辑零改动 */
  },
  store: { /* 已有 */ },
  recents: { /* 已有 */ },
  chats: { /* 已有 */ },
}
```

- [ ] **Step 3: 渲染层 ai.ts 拷贝 + 瘦身**

```bash
cp /Users/a9/Projects/db-tool/packages/ui/src/ai.ts packages/ui/src/
```

依次改：

1. 删公司头；删 `import type { DbDialect } from '@db-tool/shared-types'`。
2. **删除**这些导出及其引用（数据库语义，工具箱用不到）：`fmtOracleType`、`AiMode`、`AskOptions`、`askAi`、`askClaude`、`extractAllSql`、`extractSql`、`embedTexts`、`isLocalEmbeddingBase`、`canEmbed`。
3. **保留**：`aiBridge`/`aiHttp` 等内部管道、`resolveKey`、`throwIfNotOk`、`ChatMessage`、`askAiChat`、`askAiChatStream`、`currentProvider`、`AiTestResult`、`testAiProvider`、SSE 解析逻辑。
4. `ChatOptions` / `CHAT_SYSTEM` / `buildSystem` 三处替换为：

```ts
export interface ChatOptions {
  messages: ChatMessage[]
  /** 当前激活工具上下文（注入 system prompt，让 AI 知道用户在用什么工具） */
  toolContext?: string
  /** 用户额外的系统提示词（追加在内置之后） */
  extraSystem?: string
  signal?: AbortSignal
}

const CHAT_SYSTEM =
  'You are Lele Assistant, a helpful expert embedded inside "Lele Tools", a desktop developer ' +
  'toolbox (formatters, encoders/decoders, generators, time and text utilities). Help the user ' +
  'with their current tool, explain results, and answer general developer questions. Be concise.'

function buildSystem(o: ChatOptions): string {
  const parts = [CHAT_SYSTEM, langPrompt()]
  if (o.toolContext) parts.push(`Current tool context:\n${o.toolContext}`)
  if (o.extraSystem) parts.push(o.extraSystem)
  return parts.join('\n\n')
}
```

5. `langPrompt()` 里把 SQL 字样改通用：`'Code blocks stay in their natural language.'`。
6. `pnpm --filter @lele/ui typecheck`，按报错清掉残余引用（`buildSystem` 内对 dialect/schema/memorySection 的引用应已随替换消失）。

- [ ] **Step 4: （可选）迁移 ai.test.ts**

```bash
cp /Users/a9/Projects/db-tool/packages/ui/src/ai.test.ts packages/ui/src/
```

删掉测试已删导出（extractSql 等）的用例，保留 SSE/解析相关；改不动就整文件删掉，后续再补。

- [ ] **Step 5: 导出 + 验证 + 提交**

`packages/ui/src/index.ts` 追加：

```ts
export {
  type AiTestResult,
  askAiChat,
  askAiChatStream,
  type ChatMessage,
  type ChatOptions,
  currentProvider,
  testAiProvider,
} from './ai'
```

```bash
pnpm typecheck && pnpm --filter @lele/ui test
git add -A && git commit -m "feat: port AI stack from db-tool (main-process proxy + multi-provider client)"
```

---

### Task 10: AiChatPanel + 设置里的 AI provider 区

**Files:**
- Create: `packages/ui/src/components/AiChatPanel.vue`
- Modify: `packages/ui/src/components/SettingsDialog.vue`, `packages/ui/src/Workspace.vue`

- [ ] **Step 1: AiChatPanel.vue（全新，对接 askAiChatStream）**

```vue
<script setup lang="ts">
import { marked } from 'marked'
import { nextTick, onMounted, ref } from 'vue'
import { askAiChatStream, type ChatMessage } from '../ai'
import { t } from '../i18n'
import { isActiveAiConfigured } from '../settings'

const props = defineProps<{ toolContext?: string }>()
const emit = defineEmits<{ close: [] }>()

const messages = ref<ChatMessage[]>([])
const input = ref('')
const busy = ref(false)
const error = ref('')
const listEl = ref<HTMLElement>()
let abort: AbortController | null = null

onMounted(async () => {
  const rows = (await window.api?.chats?.list?.()) ?? []
  messages.value = rows.map((r) => ({ role: r.role, content: r.content }))
  scrollDown()
})

function scrollDown(): void {
  void nextTick(() => listEl.value?.scrollTo({ top: listEl.value.scrollHeight }))
}

function render(md: string): string {
  return marked.parse(md, { async: false }) as string
}

async function send(): Promise<void> {
  const text = input.value.trim()
  if (!text || busy.value) return
  if (!isActiveAiConfigured()) {
    error.value = t('ai.notConfigured')
    return
  }
  error.value = ''
  input.value = ''
  messages.value.push({ role: 'user', content: text })
  void window.api?.chats?.append?.('user', text)
  messages.value.push({ role: 'assistant', content: '' })
  scrollDown()
  busy.value = true
  abort = new AbortController()
  const last = messages.value[messages.value.length - 1]
  try {
    const full = await askAiChatStream(
      {
        messages: messages.value.slice(0, -1),
        toolContext: props.toolContext,
        signal: abort.signal,
      },
      (delta) => {
        last.content += delta
        scrollDown()
      },
    )
    last.content = full || last.content
    void window.api?.chats?.append?.('assistant', last.content)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!last.content) messages.value.pop()
    if (msg !== 'AbortError' && !/abort/i.test(msg)) error.value = msg
  } finally {
    busy.value = false
    abort = null
  }
}

function stop(): void {
  abort?.abort()
}

async function clearAll(): Promise<void> {
  messages.value = []
  await window.api?.chats?.clear?.()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void send()
  }
}
</script>

<template>
  <aside class="ai-panel">
    <div class="head">
      <span>{{ t('ai.title') }}</span>
      <span class="sp" />
      <button class="btn" @click="clearAll">{{ t('common.clear') }}</button>
      <button class="btn" @click="emit('close')">×</button>
    </div>
    <div ref="listEl" class="list">
      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <div v-if="m.role === 'assistant'" class="md" v-html="render(m.content)" />
        <div v-else class="raw">{{ m.content }}</div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
    <div class="foot">
      <textarea v-model="input" class="textarea" rows="3" :placeholder="t('ai.placeholder')" @keydown="onKey" />
      <button v-if="!busy" class="btn primary" @click="send">{{ t('ai.send') }}</button>
      <button v-else class="btn" @click="stop">{{ t('ai.stop') }}</button>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-left: 1px solid var(--border);
  background: var(--bg-soft);
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    .sp { flex: 1; }
  }
  .list { flex: 1; overflow-y: auto; padding: 10px; }
  .msg {
    margin-bottom: 10px;
    &.user .raw {
      background: var(--accent);
      color: var(--accent-fg);
      border-radius: 10px 10px 2px 10px;
      padding: 6px 10px;
      margin-left: 40px;
      white-space: pre-wrap;
    }
    &.assistant .md {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px 10px 10px 2px;
      padding: 6px 10px;
      margin-right: 24px;
      overflow-x: auto;
      :deep(pre) { background: var(--bg-hover); padding: 8px; border-radius: 6px; overflow-x: auto; }
      :deep(p:first-child) { margin-top: 0; }
      :deep(p:last-child) { margin-bottom: 0; }
    }
  }
  .error { color: var(--danger); font-size: 12px; }
  .foot {
    display: flex;
    gap: 6px;
    align-items: flex-end;
    padding: 8px;
    border-top: 1px solid var(--border);
    .textarea { flex: 1; }
  }
}
</style>
```

- [ ] **Step 2: SettingsDialog 加 AI 区**

在 `<!-- Task 10 在这里追加 -->` 处替换为：

```html
<h4>{{ t('settings.ai') }}</h4>
<label class="field">
  <span>{{ t('settings.ai.provider') }}</span>
  <select v-model="settings.aiProvider" class="select">
    <option v-for="p in AI_PROVIDER_ORDER" :key="p" :value="p">{{ AI_PROVIDER_LABEL[p] }}</option>
  </select>
</label>
<label v-if="!isLocalAiProvider(settings.aiProvider)" class="field">
  <span>{{ t('settings.ai.apiKey') }}</span>
  <input v-model="settings.aiProviders[settings.aiProvider].apiKey" class="input" type="password" />
</label>
<label class="field">
  <span>{{ t('settings.ai.model') }}</span>
  <input v-model="settings.aiProviders[settings.aiProvider].model" class="input" />
</label>
<label class="field">
  <span>{{ t('settings.ai.baseUrl') }}</span>
  <input v-model="settings.aiProviders[settings.aiProvider].baseUrl" class="input" />
</label>
<div class="field">
  <span />
  <button class="btn" :disabled="testing" @click="runTest">
    {{ testing ? '…' : t('settings.ai.test') }}
  </button>
</div>
<p v-if="testResult" :class="testResult.startsWith('OK') ? 'hint' : 'error'" style="font-size: 12px">
  {{ testResult }}
</p>
```

script 区追加：

```ts
import { ref } from 'vue'
import { testAiProvider } from '../ai'
import { AI_PROVIDER_LABEL, AI_PROVIDER_ORDER, isLocalAiProvider } from '../settings'

const testing = ref(false)
const testResult = ref('')

async function runTest(): Promise<void> {
  testing.value = true
  testResult.value = ''
  try {
    const r = await testAiProvider(settings.aiProvider, settings.aiProviders[settings.aiProvider])
    // testAiProvider 的返回结构以 Task 9 移植后的实际签名为准（AiTestResult）
    testResult.value = r.ok ? `OK: ${t('settings.ai.testOk')}` : (r.message ?? 'failed')
  } catch (e) {
    testResult.value = e instanceof Error ? e.message : String(e)
  } finally {
    testing.value = false
  }
}
```

注意：`testAiProvider` 参数与 `AiTestResult` 字段以移植后 `ai.ts` 的实际签名为准（移植时 DB 版签名在 ai.ts L591-600 附近），对不上就按实际签名改这段调用。

- [ ] **Step 3: Workspace 接入面板**

Workspace.vue：

```ts
import AiChatPanel from './components/AiChatPanel.vue'
import { computed } from 'vue'
import { locale } from './i18n'

const showAi = ref(false)
const toolContext = computed(() => {
  const meta = active.value ? toolById(active.value) : null
  return meta ? `User is on tool "${meta.name.en} / ${meta.name.zh}"` : undefined
})
```

布局改三列：grid-template-columns 由 `240px 1fr` 改为动态 —— 模板根：

```html
<div class="workspace" :class="{ 'with-ai': showAi }">
  <SideNav ... />
  <div class="main"> ...原有... </div>
  <AiChatPanel v-if="showAi" :tool-context="toolContext" @close="showAi = false" />
</div>
```

```scss
.workspace {
  grid-template-columns: 240px 1fr;
  &.with-ai { grid-template-columns: 240px 1fr 340px; }
}
```

ToolTabs 那行右侧加唤起按钮——在 `.main` 里 ToolTabs 旁包一行：

```html
<div class="tabbar-row">
  <ToolTabs class="grow" :tabs="tabs" :active="active" @activate="active = $event" @close="close" />
  <button class="btn ai-toggle" @click="showAi = !showAi">🤖</button>
</div>
```

```scss
.tabbar-row { display: flex; align-items: stretch; .grow { flex: 1; min-width: 0; } .ai-toggle { margin: 6px 8px 0; } }
```

- [ ] **Step 4: 验证 + 提交**

```bash
pnpm typecheck && pnpm dev
# 设置里填 DeepSeek key（或 Ollama 本地）→ 测试连接 OK → 🤖 开面板 → 问"你好"能流式回答；
# 重启后历史还在；流式中点停止能中断
git add -A && git commit -m "feat: global AI chat panel with provider settings"
```

---

### Task 11: Monaco 接入（NLS 中文 + 编辑器组件）

**Files:**
- Copy: DB `packages/ui/src/monaco-setup.ts`, `monaco-nls.ts`, `vendor/monaco-nls-shim.ts`, `vendor/monaco-nls-zh-cn.ts`
- Create: `packages/ui/src/components/MonacoEditor.vue`

- [ ] **Step 1: 拷四个文件**

```bash
cp /Users/a9/Projects/db-tool/packages/ui/src/monaco-setup.ts packages/ui/src/
cp /Users/a9/Projects/db-tool/packages/ui/src/monaco-nls.ts packages/ui/src/
cp /Users/a9/Projects/db-tool/packages/ui/src/vendor/monaco-nls-shim.ts packages/ui/src/vendor/
cp /Users/a9/Projects/db-tool/packages/ui/src/vendor/monaco-nls-zh-cn.ts packages/ui/src/vendor/
```

删公司头；monaco-setup.ts 若 import 了 db 专属语言注册（sql-formatter / 方言补全等），删掉那些段落，只保留 worker 环境配置（`self.MonacoEnvironment`）与主题/NLS 初始化；若 import `./i18n` 的 `locale` 保留（我们的 i18n 同名导出）。`pnpm --filter @lele/ui typecheck` 收口。

- [ ] **Step 2: MonacoEditor.vue**

```vue
<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { setupMonaco } from '../monaco-setup'
import { resolvedTheme } from '../settings'

const props = defineProps<{ modelValue: string; language: string; readOnly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

const host = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  setupMonaco() // 幂等：worker 环境 + NLS（以拷来的 monaco-setup.ts 实际导出名为准）
  editor = monaco.editor.create(host.value as HTMLElement, {
    value: props.modelValue,
    language: props.language,
    theme: resolvedTheme.value === 'dark' ? 'vs-dark' : 'vs',
    automaticLayout: true,
    minimap: { enabled: false },
    readOnly: props.readOnly ?? false,
    fontSize: 13,
    scrollBeyondLastLine: false,
  })
  editor.onDidChangeModelContent(() => {
    const v = editor?.getValue() ?? ''
    if (v !== props.modelValue) emit('update:modelValue', v)
  })
})

watch(
  () => props.modelValue,
  (v) => {
    if (editor && editor.getValue() !== v) editor.setValue(v)
  },
)
watch(
  () => props.language,
  (l) => {
    const m = editor?.getModel()
    if (m) monaco.editor.setModelLanguage(m, l)
  },
)
watch(resolvedTheme, (m) => monaco.editor.setTheme(m === 'dark' ? 'vs-dark' : 'vs'))

onBeforeUnmount(() => editor?.dispose())
</script>

<template>
  <div ref="host" class="monaco-host" />
</template>

<style scoped>
.monaco-host {
  height: 100%;
  min-height: 120px;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
</style>
```

注意：`setupMonaco` 名字以拷来的 monaco-setup.ts 实际导出为准；若它是「import 即生效」无导出函数，把 `setupMonaco()` 行换成 `import '../monaco-setup'`。

- [ ] **Step 3: 验证 + 提交**

```bash
pnpm --filter @lele/ui typecheck
git add -A && git commit -m "feat: monaco editor component with zh NLS shim"
```

（运行时验证放 Task 12 的 JSON 工具里做：右键菜单应是中文。）

---

### Task 12: 工具 ×3 — JSON / XML / YAML 格式化（TDD: xml-format）

**Files:**
- Create: `packages/ui/src/tools/json-formatter/{meta.ts,Tool.vue}`
- Create: `packages/ui/src/tools/xml-formatter/{meta.ts,Tool.vue,xml-format.ts,xml-format.test.ts}`
- Create: `packages/ui/src/tools/yaml-formatter/{meta.ts,Tool.vue}`
- Modify: `packages/ui/src/tools/index.ts`

- [ ] **Step 1: 写 xml-format 失败测试**

`packages/ui/src/tools/xml-formatter/xml-format.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { formatXml } from './xml-format'

describe('formatXml', () => {
  it('indents nested elements', () => {
    expect(formatXml('<a><b><c>x</c></b></a>')).toBe('<a>\n  <b>\n    <c>x</c>\n  </b>\n</a>')
  })
  it('keeps declaration and self-closing tags', () => {
    expect(formatXml('<?xml version="1.0"?><r><e/></r>')).toBe('<?xml version="1.0"?>\n<r>\n  <e/>\n</r>')
  })
  it('throws on malformed xml', () => {
    expect(() => formatXml('<a><b></a>')).toThrow()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm --filter @lele/ui test -- xml-format
# 期望：FAIL，Cannot find module './xml-format'
```

- [ ] **Step 3: 实现 xml-format.ts**

```ts
/** 浏览器 DOMParser 校验 + 手写缩进序列化（不引第三方）。 */
export function formatXml(src: string, indent = '  '): string {
  const doc = new DOMParser().parseFromString(src, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('XML 解析失败 / malformed XML')

  // 在 > < 之间断行，再按标签开闭算缩进
  const tokens = src
    .replace(/>\s+</g, '><')
    .replace(/></g, '>\n<')
    .split('\n')
  let depth = 0
  const out: string[] = []
  for (const tk of tokens) {
    const isClose = /^<\//.test(tk)
    const isSelf = /\/>$/.test(tk) || /^<\?/.test(tk) || /^<!/.test(tk)
    const isOpenAndClose = /^<[^/!?][^>]*>.*<\/[^>]+>$/.test(tk)
    if (isClose) depth = Math.max(0, depth - 1)
    out.push(indent.repeat(depth) + tk)
    if (!isClose && !isSelf && !isOpenAndClose && /^</.test(tk)) depth++
  }
  return out.join('\n')
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm --filter @lele/ui test -- xml-format
# 期望：3 passed
```

（DOMParser 在 vitest node 环境不存在 → 在 `xml-format.test.ts` 文件最顶部加 docblock `/** @vitest-environment jsdom */`，并在根 package.json devDeps 加 `"jsdom": "^25.0.0"` 后 `pnpm install`。只影响这一个测试文件。）

- [ ] **Step 5: 三个工具 UI**

`tools/json-formatter/meta.ts`：

```ts
import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'json-formatter',
  name: { zh: 'JSON 格式化', en: 'JSON Formatter' },
  desc: { zh: '格式化 / 压缩 / 校验 JSON', en: 'Format, minify and validate JSON' },
  category: 'format',
  keywords: ['json', 'format', 'pretty', '格式化'],
  icon: '{}',
  load: () => import('./Tool.vue'),
}
```

`tools/json-formatter/Tool.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import MonacoEditor from '../../components/MonacoEditor.vue'
import { t } from '../../i18n'

const text = ref('{\n  "hello": "lele"\n}')
const error = ref('')

function run(indent: number): void {
  error.value = ''
  try {
    text.value = JSON.stringify(JSON.parse(text.value), null, indent)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(text.value)
}
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <button class="btn primary" @click="run(2)">格式化 (2)</button>
      <button class="btn" @click="run(4)">格式化 (4)</button>
      <button class="btn" @click="run(0)">压缩</button>
      <button class="btn" @click="copy">{{ t('common.copy') }}</button>
      <span class="error">{{ error }}</span>
    </div>
    <MonacoEditor v-model="text" language="json" class="grow" />
  </div>
</template>
```

`tools/xml-formatter/meta.ts`（同构）：id `xml-formatter`，name `XML 格式化 / XML Formatter`，icon `<>`，keywords `['xml', 'format', '格式化']`。

`tools/xml-formatter/Tool.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import MonacoEditor from '../../components/MonacoEditor.vue'
import { formatXml } from './xml-format'

const text = ref('<root><item id="1">hello</item></root>')
const error = ref('')

function run(): void {
  error.value = ''
  try {
    text.value = formatXml(text.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
function minify(): void {
  error.value = ''
  text.value = text.value.replace(/>\s+</g, '><').trim()
}
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <button class="btn primary" @click="run">格式化</button>
      <button class="btn" @click="minify">压缩</button>
      <span class="error">{{ error }}</span>
    </div>
    <MonacoEditor v-model="text" language="xml" class="grow" />
  </div>
</template>
```

`tools/yaml-formatter/meta.ts`：id `yaml-formatter`，name `YAML 格式化 / YAML Formatter`，icon `▤`，keywords `['yaml', 'yml', 'json', '转换']`，desc `YAML 格式化与 JSON 互转 / Format YAML and convert to/from JSON`。

`tools/yaml-formatter/Tool.vue`：

```vue
<script setup lang="ts">
import { parse, stringify } from 'yaml'
import { ref } from 'vue'
import MonacoEditor from '../../components/MonacoEditor.vue'

const text = ref('hello: lele\nitems:\n  - 1\n  - 2\n')
const lang = ref<'yaml' | 'json'>('yaml')
const error = ref('')

function guard(fn: () => void): void {
  error.value = ''
  try {
    fn()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
const fmt = () => guard(() => { text.value = stringify(parse(text.value)); lang.value = 'yaml' })
const toJson = () => guard(() => { text.value = JSON.stringify(parse(text.value), null, 2); lang.value = 'json' })
const toYaml = () => guard(() => { text.value = stringify(JSON.parse(text.value)); lang.value = 'yaml' })
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <button class="btn primary" @click="fmt">格式化 YAML</button>
      <button class="btn" @click="toJson">YAML → JSON</button>
      <button class="btn" @click="toYaml">JSON → YAML</button>
      <span class="error">{{ error }}</span>
    </div>
    <MonacoEditor v-model="text" :language="lang" class="grow" />
  </div>
</template>
```

- [ ] **Step 6: 注册**

`tools/index.ts`：

```ts
import type { ToolMeta } from '../registry'
import { meta as jsonFormatter } from './json-formatter/meta'
import { meta as xmlFormatter } from './xml-formatter/meta'
import { meta as yamlFormatter } from './yaml-formatter/meta'

export const TOOLS: ToolMeta[] = [jsonFormatter, xmlFormatter, yamlFormatter]

export function toolById(id: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.id === id)
}
```

- [ ] **Step 7: 验证 + 提交**

```bash
pnpm --filter @lele/ui test && pnpm typecheck && pnpm dev
# 三个工具均可打开；JSON 编辑器右键菜单是中文（NLS shim 生效）；
# Tab 切换后再切回，编辑内容保留；最近使用区出现这三个工具
git add -A && git commit -m "feat: json/xml/yaml formatter tools with monaco"
```

---

### Task 13: 工具 ×2 — Base64 / 进制转换（TDD: convert）

**Files:**
- Create: `packages/ui/src/tools/base64/{meta.ts,Tool.vue,codec.ts,codec.test.ts}`
- Create: `packages/ui/src/tools/base-convert/{meta.ts,Tool.vue,convert.ts,convert.test.ts}`
- Modify: `packages/ui/src/tools/index.ts`

- [ ] **Step 1: 失败测试**

`tools/base64/codec.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { decodeB64, encodeB64 } from './codec'

describe('base64 codec (UTF-8 safe)', () => {
  it('roundtrips ascii', () => {
    expect(decodeB64(encodeB64('hello'))).toBe('hello')
    expect(encodeB64('hello')).toBe('aGVsbG8=')
  })
  it('roundtrips chinese + emoji', () => {
    const s = '乐乐的工具箱 🧰'
    expect(decodeB64(encodeB64(s))).toBe(s)
  })
  it('decode throws on invalid input', () => {
    expect(() => decodeB64('!!!not-base64!!!')).toThrow()
  })
})
```

`tools/base-convert/convert.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { convertBase } from './convert'

describe('convertBase', () => {
  it('dec → hex/bin/oct', () => {
    expect(convertBase('255', 10, 16)).toBe('ff')
    expect(convertBase('255', 10, 2)).toBe('11111111')
    expect(convertBase('255', 10, 8)).toBe('377')
  })
  it('hex → dec, case-insensitive', () => {
    expect(convertBase('FF', 16, 10)).toBe('255')
    expect(convertBase('ff', 16, 10)).toBe('255')
  })
  it('handles big values via BigInt', () => {
    expect(convertBase('ffffffffffffffff', 16, 10)).toBe('18446744073709551615')
  })
  it('rejects digits out of base', () => {
    expect(() => convertBase('129', 2, 10)).toThrow()
  })
  it('supports negative numbers', () => {
    expect(convertBase('-ff', 16, 10)).toBe('-255')
  })
})
```

- [ ] **Step 2: 确认失败**

```bash
pnpm --filter @lele/ui test -- tools/base
# 期望：两个文件都 FAIL（模块不存在）
```

- [ ] **Step 3: 实现**

`tools/base64/codec.ts`：

```ts
/** UTF-8 安全 Base64（btoa 只认 Latin-1，先 TextEncoder 转字节）。 */
export function encodeB64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function decodeB64(b64: string): string {
  const bin = atob(b64.trim())
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}
```

（atob 在 node ≥16 全局可用，测试无需 jsdom。）

`tools/base-convert/convert.ts`：

```ts
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

/** 任意 2-36 进制互转，BigInt 实现不丢精度。 */
export function convertBase(value: string, from: number, to: number): string {
  const v = value.trim().toLowerCase()
  if (!v) throw new Error('empty input')
  const neg = v.startsWith('-')
  const body = neg ? v.slice(1) : v
  let acc = 0n
  const fromB = BigInt(from)
  for (const ch of body) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= from) throw new Error(`非法字符 "${ch}" (base ${from})`)
    acc = acc * fromB + BigInt(d)
  }
  if (acc === 0n) return '0'
  const toB = BigInt(to)
  let out = ''
  while (acc > 0n) {
    out = DIGITS[Number(acc % toB)] + out
    acc /= toB
  }
  return (neg ? '-' : '') + out
}
```

- [ ] **Step 4: 确认通过**

```bash
pnpm --filter @lele/ui test -- tools/base
# 期望：8 passed
```

- [ ] **Step 5: UI + meta**

`tools/base64/meta.ts`：id `base64`，name `Base64 编解码 / Base64`，category `format`，icon `🅱`，keywords `['base64', 'encode', 'decode', '编码', '解码']`。

`tools/base64/Tool.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { copyText } from '../../clipboard'
import { t } from '../../i18n'
import { decodeB64, encodeB64 } from './codec'

const input = ref('')
const output = ref('')
const error = ref('')

function run(fn: (s: string) => string): void {
  error.value = ''
  try {
    output.value = fn(input.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
const swap = () => { input.value = output.value; output.value = '' }
</script>

<template>
  <div class="tool-page">
    <textarea v-model="input" class="textarea grow" rows="8" placeholder="输入文本或 Base64…" />
    <div class="row">
      <button class="btn primary" @click="run(encodeB64)">编码 Encode</button>
      <button class="btn primary" @click="run(decodeB64)">解码 Decode</button>
      <button class="btn" @click="swap">↕ 交换</button>
      <button class="btn" @click="copyText(output)">{{ t('common.copy') }}</button>
      <span class="error">{{ error }}</span>
    </div>
    <textarea :value="output" class="textarea grow" rows="8" readonly />
  </div>
</template>
```

`tools/base-convert/meta.ts`：id `base-convert`，name `进制转换 / Base Converter`，category `format`，icon `⇄`，keywords `['hex', 'binary', 'oct', '进制', '二进制', '十六进制']`。

`tools/base-convert/Tool.vue`：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { copyText } from '../../clipboard'
import { convertBase } from './convert'

const input = ref('255')
const fromBase = ref(10)
const BASES = [2, 8, 10, 16, 36]

const results = computed(() => {
  try {
    return { rows: BASES.map((b) => ({ base: b, value: convertBase(input.value, fromBase.value, b) })), error: '' }
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) }
  }
})
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <input v-model="input" class="input grow" placeholder="数值…" />
      <select v-model.number="fromBase" class="select">
        <option v-for="b in 35" :key="b" :value="b + 1">base {{ b + 1 }}</option>
      </select>
    </div>
    <p class="error">{{ results.error }}</p>
    <table v-if="results.rows.length" class="result">
      <tr v-for="r in results.rows" :key="r.base">
        <td class="hint">base {{ r.base }}</td>
        <td><code>{{ r.value }}</code></td>
        <td><button class="btn" @click="copyText(r.value)">⧉</button></td>
      </tr>
    </table>
  </div>
</template>

<style scoped>
.result td { padding: 4px 10px 4px 0; }
</style>
```

- [ ] **Step 6: 注册 + 验证 + 提交**

tools/index.ts 加两行 import + 数组追加（模式同 Task 12 Step 6）。

```bash
pnpm --filter @lele/ui test && pnpm typecheck && pnpm dev   # 手验两个工具
git add -A && git commit -m "feat: base64 codec and base converter tools"
```

---

### Task 14: 工具 ×2 — 正则测试 / 字符统计（TDD: count）

**Files:**
- Create: `packages/ui/src/tools/regex-test/{meta.ts,Tool.vue}`
- Create: `packages/ui/src/tools/char-counter/{meta.ts,Tool.vue,count.ts,count.test.ts}`
- Modify: `packages/ui/src/tools/index.ts`

- [ ] **Step 1: count 失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { countText } from './count'

describe('countText', () => {
  it('counts chars / no-space / lines / words / cjk', () => {
    const r = countText('hello 世界\nfoo bar')
    expect(r.chars).toBe(16)
    expect(r.charsNoSpace).toBe(13)
    expect(r.lines).toBe(2)
    expect(r.words).toBe(3) // hello foo bar（CJK 不算英文词）
    expect(r.cjk).toBe(2)
  })
  it('empty text', () => {
    expect(countText('')).toEqual({ chars: 0, charsNoSpace: 0, lines: 0, words: 0, cjk: 0 })
  })
})
```

- [ ] **Step 2: 确认失败**

```bash
pnpm --filter @lele/ui test -- count
# FAIL: Cannot find module './count'
```

- [ ] **Step 3: 实现 count.ts**

```ts
export interface TextStats {
  chars: number
  charsNoSpace: number
  lines: number
  words: number
  cjk: number
}

export function countText(s: string): TextStats {
  if (!s) return { chars: 0, charsNoSpace: 0, lines: 0, words: 0, cjk: 0 }
  const chars = [...s].length
  const charsNoSpace = [...s.replace(/\s/g, '')].length
  const lines = s.split('\n').length
  const words = (s.match(/[A-Za-z0-9_'-]+/g) ?? []).length
  const cjk = (s.match(/[一-鿿㐀-䶿]/g) ?? []).length
  return { chars, charsNoSpace, lines, words, cjk }
}
```

- [ ] **Step 4: 确认通过**

```bash
pnpm --filter @lele/ui test -- count   # 2 passed
```

- [ ] **Step 5: UI**

`tools/char-counter/meta.ts`：id `char-counter`，name `字符统计 / Character Counter`，category `text`，icon `🔢`，keywords `['count', 'word', '统计', '字数']`。

`tools/char-counter/Tool.vue`：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { countText } from './count'

const text = ref('')
const stats = computed(() => countText(text.value))
const ITEMS = [
  ['chars', '字符数'],
  ['charsNoSpace', '字符数（不含空白）'],
  ['words', '单词数'],
  ['cjk', '中日韩字符'],
  ['lines', '行数'],
] as const
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <span v-for="[k, label] in ITEMS" :key="k" class="stat">
        <b>{{ stats[k] }}</b> <span class="hint">{{ label }}</span>
      </span>
    </div>
    <textarea v-model="text" class="textarea grow" rows="16" placeholder="粘贴文本…" />
  </div>
</template>

<style scoped>
.stat { margin-right: 16px; }
.stat b { font-size: 16px; }
</style>
```

`tools/regex-test/meta.ts`：id `regex-test`，name `正则测试 / Regex Tester`，category `text`，icon `.*`，keywords `['regex', 'regexp', '正则', '匹配']`。

`tools/regex-test/Tool.vue`：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

const pattern = ref('\\d+')
const flags = ref('g')
const text = ref('order 42, qty 7')

const result = computed(() => {
  try {
    const re = new RegExp(pattern.value, flags.value)
    const matches: { m: string; index: number; groups: string[] }[] = []
    if (flags.value.includes('g')) {
      for (const mm of text.value.matchAll(re)) {
        matches.push({ m: mm[0], index: mm.index ?? 0, groups: mm.slice(1) })
        if (matches.length > 500) break
      }
    } else {
      const mm = re.exec(text.value)
      if (mm) matches.push({ m: mm[0], index: mm.index, groups: mm.slice(1) })
    }
    return { matches, error: '' }
  } catch (e) {
    return { matches: [], error: e instanceof Error ? e.message : String(e) }
  }
})
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <span>/</span>
      <input v-model="pattern" class="input grow" spellcheck="false" />
      <span>/</span>
      <input v-model="flags" class="input" style="width: 70px" placeholder="gimsuy" />
      <span class="hint">{{ result.matches.length }} 个匹配</span>
    </div>
    <p class="error">{{ result.error }}</p>
    <textarea v-model="text" class="textarea grow" rows="8" placeholder="被测文本…" />
    <div class="grow" style="overflow: auto">
      <table>
        <tr v-for="(m, i) in result.matches" :key="i">
          <td class="hint">@{{ m.index }}</td>
          <td><code>{{ m.m }}</code></td>
          <td class="hint">{{ m.groups.length ? `groups: ${m.groups.join(' | ')}` : '' }}</td>
        </tr>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 6: 注册 + 验证 + 提交**

```bash
pnpm --filter @lele/ui test && pnpm typecheck && pnpm dev
git add -A && git commit -m "feat: regex tester and character counter tools"
```

---

### Task 15: 工具 ×1 — 文本加解密（TDD: AES-GCM）

**Files:**
- Create: `packages/ui/src/tools/text-crypto/{meta.ts,Tool.vue,crypto.ts,crypto.test.ts}`
- Modify: `packages/ui/src/tools/index.ts`

- [ ] **Step 1: 失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { decryptText, encryptText } from './crypto'

describe('text crypto (AES-256-GCM + PBKDF2)', () => {
  it('roundtrips', async () => {
    const ct = await encryptText('机密 secret 🤫', 'pass123')
    expect(ct).not.toContain('机密')
    expect(await decryptText(ct, 'pass123')).toBe('机密 secret 🤫')
  })
  it('wrong password rejects', async () => {
    const ct = await encryptText('x', 'right')
    await expect(decryptText(ct, 'wrong')).rejects.toThrow()
  })
  it('garbage input rejects', async () => {
    await expect(decryptText('not-a-payload', 'p')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: 确认失败**

```bash
pnpm --filter @lele/ui test -- text-crypto   # FAIL: 模块不存在
```

- [ ] **Step 3: 实现 crypto.ts**

```ts
/** AES-256-GCM，密钥由 PBKDF2(SHA-256, 100k) 从口令派生；payload = base64(salt16 + iv12 + ct)。 */

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function toB64(b: Uint8Array): string {
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s)
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0))
}

export async function encryptText(plain: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)),
  )
  const out = new Uint8Array(salt.length + iv.length + ct.length)
  out.set(salt, 0)
  out.set(iv, 16)
  out.set(ct, 28)
  return toB64(out)
}

export async function decryptText(payload: string, password: string): Promise<string> {
  const bytes = fromB64(payload)
  if (bytes.length < 29) throw new Error('payload 太短，不是合法密文')
  const key = await deriveKey(password, bytes.slice(0, 16))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(16, 28) }, key, bytes.slice(28))
  return new TextDecoder().decode(plain)
}
```

- [ ] **Step 4: 确认通过**

```bash
pnpm --filter @lele/ui test -- text-crypto   # 3 passed（node ≥20 自带 WebCrypto）
```

- [ ] **Step 5: meta + Tool.vue**

meta：id `text-crypto`，name `文本加解密 / Text Encrypt`，category `text`，icon `🔐`，keywords `['aes', 'encrypt', 'decrypt', '加密', '解密']`，desc `AES-256-GCM 口令加解密 / Password-based AES-256-GCM`。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { decryptText, encryptText } from './crypto'

const input = ref('')
const password = ref('')
const output = ref('')
const error = ref('')

async function run(fn: (s: string, p: string) => Promise<string>): Promise<void> {
  error.value = ''
  try {
    output.value = await fn(input.value, password.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="tool-page">
    <textarea v-model="input" class="textarea grow" rows="7" placeholder="明文或密文…" />
    <div class="row">
      <input v-model="password" class="input grow" type="password" placeholder="口令…" />
      <button class="btn primary" :disabled="!password" @click="run(encryptText)">加密</button>
      <button class="btn primary" :disabled="!password" @click="run(decryptText)">解密</button>
      <span class="error">{{ error }}</span>
    </div>
    <textarea :value="output" class="textarea grow" rows="7" readonly />
  </div>
</template>
```

- [ ] **Step 6: 注册 + 验证 + 提交**

```bash
pnpm --filter @lele/ui test && pnpm typecheck
git add -A && git commit -m "feat: text encryption tool (AES-256-GCM)"
```

---

### Task 16: 工具 ×2 — UUID / 随机密码（TDD: password）

**Files:**
- Create: `packages/ui/src/tools/uuid-gen/{meta.ts,Tool.vue}`
- Create: `packages/ui/src/tools/password-gen/{meta.ts,Tool.vue,gen.ts,gen.test.ts}`
- Modify: `packages/ui/src/tools/index.ts`

- [ ] **Step 1: gen 失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { generatePassword } from './gen'

describe('generatePassword', () => {
  it('respects length', () => {
    expect(generatePassword({ length: 24, lower: true, upper: true, digits: true, symbols: false })).toHaveLength(24)
  })
  it('contains at least one char from each enabled class', () => {
    for (let i = 0; i < 20; i++) {
      const p = generatePassword({ length: 8, lower: true, upper: true, digits: true, symbols: true })
      expect(p).toMatch(/[a-z]/)
      expect(p).toMatch(/[A-Z]/)
      expect(p).toMatch(/\d/)
      expect(p).toMatch(/[^a-zA-Z0-9]/)
    }
  })
  it('throws when no class enabled or length too short', () => {
    expect(() => generatePassword({ length: 8, lower: false, upper: false, digits: false, symbols: false })).toThrow()
    expect(() => generatePassword({ length: 2, lower: true, upper: true, digits: true, symbols: true })).toThrow()
  })
})
```

- [ ] **Step 2: 确认失败**

```bash
pnpm --filter @lele/ui test -- password-gen   # FAIL
```

- [ ] **Step 3: 实现 gen.ts**

```ts
export interface PasswordOpts {
  length: number
  lower: boolean
  upper: boolean
  digits: boolean
  symbols: boolean
}

const CLASSES: [keyof Omit<PasswordOpts, 'length'>, string][] = [
  ['lower', 'abcdefghijkmnpqrstuvwxyz'], // 去 l/o 易混字符
  ['upper', 'ABCDEFGHJKLMNPQRSTUVWXYZ'], // 去 I/O
  ['digits', '23456789'], // 去 0/1
  ['symbols', '!@#$%^&*_-+=?'],
]

function randInt(maxExclusive: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % maxExclusive
}

export function generatePassword(o: PasswordOpts): string {
  const enabled = CLASSES.filter(([k]) => o[k])
  if (enabled.length === 0) throw new Error('至少选择一类字符')
  if (o.length < enabled.length) throw new Error(`长度至少 ${enabled.length}`)
  const all = enabled.map(([, s]) => s).join('')
  // 先保证每类一个，再随机填充，最后洗牌
  const chars = enabled.map(([, s]) => s[randInt(s.length)])
  while (chars.length < o.length) chars.push(all[randInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
```

- [ ] **Step 4: 确认通过**

```bash
pnpm --filter @lele/ui test -- password-gen   # 3 passed
```

- [ ] **Step 5: 两个 UI**

`tools/password-gen/meta.ts`：id `password-gen`，name `随机密码 / Password Generator`，category `generator`，icon `🔑`，keywords `['password', 'random', '密码']`。

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { copyText } from '../../clipboard'
import { t } from '../../i18n'
import { generatePassword } from './gen'

const opts = reactive({ length: 16, lower: true, upper: true, digits: true, symbols: true })
const out = ref<string[]>([])
const error = ref('')

function run(): void {
  error.value = ''
  try {
    out.value = Array.from({ length: 5 }, () => generatePassword(opts))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
run()
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <label>长度 <input v-model.number="opts.length" class="input" type="number" min="4" max="128" style="width: 70px" /></label>
      <label><input v-model="opts.lower" type="checkbox" /> a-z</label>
      <label><input v-model="opts.upper" type="checkbox" /> A-Z</label>
      <label><input v-model="opts.digits" type="checkbox" /> 0-9</label>
      <label><input v-model="opts.symbols" type="checkbox" /> !@#</label>
      <button class="btn primary" @click="run">生成</button>
      <span class="error">{{ error }}</span>
    </div>
    <div v-for="(p, i) in out" :key="i" class="row">
      <code class="grow">{{ p }}</code>
      <button class="btn" @click="copyText(p)">{{ t('common.copy') }}</button>
    </div>
  </div>
</template>
```

`tools/uuid-gen/meta.ts`：id `uuid-gen`，name `UUID 生成 / UUID Generator`，category `generator`，icon `🆔`，keywords `['uuid', 'guid', '生成']`。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { copyText } from '../../clipboard'
import { t } from '../../i18n'

const count = ref(5)
const upper = ref(false)
const noDash = ref(false)
const out = ref<string[]>([])

function run(): void {
  out.value = Array.from({ length: Math.min(Math.max(count.value, 1), 100) }, () => {
    let u = crypto.randomUUID()
    if (noDash.value) u = u.replaceAll('-', '')
    return upper.value ? u.toUpperCase() : u
  })
}
run()
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <label>数量 <input v-model.number="count" class="input" type="number" min="1" max="100" style="width: 70px" /></label>
      <label><input v-model="upper" type="checkbox" /> 大写</label>
      <label><input v-model="noDash" type="checkbox" /> 去横线</label>
      <button class="btn primary" @click="run">生成</button>
      <button class="btn" @click="copyText(out.join('\n'))">{{ t('common.copy') }}</button>
    </div>
    <textarea :value="out.join('\n')" class="textarea grow" rows="10" readonly />
  </div>
</template>
```

- [ ] **Step 6: 注册 + 验证 + 提交**

```bash
pnpm --filter @lele/ui test && pnpm typecheck
git add -A && git commit -m "feat: uuid and password generator tools"
```

---

### Task 17: 工具 ×1 — 二维码生成

**Files:**
- Create: `packages/ui/src/tools/qr-code/{meta.ts,Tool.vue}`
- Modify: `packages/ui/src/tools/index.ts`

- [ ] **Step 1: meta + Tool.vue**

meta：id `qr-code`，name `二维码生成 / QR Code`，category `generator`，icon `▣`，keywords `['qr', 'qrcode', '二维码']`。

```vue
<script setup lang="ts">
import QRCode from 'qrcode'
import { ref, watchEffect } from 'vue'

const text = ref('https://github.com/duhbbx/lele-tools-electron')
const size = ref(280)
const ecc = ref<'L' | 'M' | 'Q' | 'H'>('M')
const canvas = ref<HTMLCanvasElement>()
const error = ref('')

watchEffect(() => {
  if (!canvas.value) return
  error.value = ''
  if (!text.value) return
  QRCode.toCanvas(canvas.value, text.value, {
    width: size.value,
    errorCorrectionLevel: ecc.value,
    margin: 2,
  }).catch((e: unknown) => {
    error.value = e instanceof Error ? e.message : String(e)
  })
})

function download(): void {
  const a = document.createElement('a')
  a.download = 'qrcode.png'
  a.href = canvas.value?.toDataURL('image/png') ?? ''
  a.click()
}
</script>

<template>
  <div class="tool-page">
    <textarea v-model="text" class="textarea" rows="4" placeholder="文本 / URL…" />
    <div class="row">
      <label>尺寸 <input v-model.number="size" class="input" type="number" min="120" max="1024" step="20" style="width: 80px" /></label>
      <label>纠错
        <select v-model="ecc" class="select">
          <option value="L">L 7%</option><option value="M">M 15%</option>
          <option value="Q">Q 25%</option><option value="H">H 30%</option>
        </select>
      </label>
      <button class="btn" @click="download">下载 PNG</button>
      <span class="error">{{ error }}</span>
    </div>
    <canvas ref="canvas" style="align-self: flex-start; background: #fff; border-radius: 8px" />
  </div>
</template>
```

- [ ] **Step 2: 注册 + 验证 + 提交**

```bash
pnpm typecheck && pnpm dev   # 输入文字出码、改纠错等级码变化、下载 PNG 可扫
git add -A && git commit -m "feat: qr code generator tool"
```

---

### Task 18: 工具 ×2 — 时间戳·日期 / Cron（TDD）

**Files:**
- Create: `packages/ui/src/tools/date-time/{meta.ts,Tool.vue,time.ts,time.test.ts}`
- Create: `packages/ui/src/tools/cron/{meta.ts,Tool.vue,cron.ts,cron.test.ts}`
- Modify: `packages/ui/src/tools/index.ts`

- [ ] **Step 1: 失败测试两份**

`tools/date-time/time.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { normalizeTs, tsToStrings } from './time'

describe('timestamp utils', () => {
  it('detects seconds vs milliseconds', () => {
    expect(normalizeTs('1717545600')).toBe(1717545600000)
    expect(normalizeTs('1717545600000')).toBe(1717545600000)
  })
  it('throws on non-numeric', () => {
    expect(() => normalizeTs('abc')).toThrow()
  })
  it('formats iso', () => {
    expect(tsToStrings(0).iso).toBe('1970-01-01T00:00:00.000Z')
  })
})
```

`tools/cron/cron.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { nextRuns } from './cron'

describe('cron nextRuns', () => {
  it('every-minute cron returns ascending future dates', () => {
    const runs = nextRuns('* * * * *', 3, new Date('2026-06-05T00:00:30Z'))
    expect(runs).toHaveLength(3)
    expect(runs[0].toISOString()).toBe('2026-06-05T00:01:00.000Z')
    expect(runs[1].getTime()).toBeGreaterThan(runs[0].getTime())
  })
  it('throws on invalid expression', () => {
    expect(() => nextRuns('99 * * * *', 1)).toThrow()
  })
})
```

- [ ] **Step 2: 确认失败**

```bash
pnpm --filter @lele/ui test -- "time|cron"   # 两份都 FAIL
```

- [ ] **Step 3: 实现**

`tools/date-time/time.ts`：

```ts
/** 10 位按秒、13 位按毫秒，其余长度按数值大小猜（< 1e12 视为秒）。 */
export function normalizeTs(input: string): number {
  const n = Number(input.trim())
  if (!Number.isFinite(n)) throw new Error('不是数字')
  return Math.abs(n) < 1e12 ? n * 1000 : n
}

export function tsToStrings(ms: number): { iso: string; local: string; date: Date } {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) throw new Error('非法时间戳')
  return { iso: d.toISOString(), local: d.toLocaleString(), date: d }
}
```

`tools/cron/cron.ts`：

```ts
import parser from 'cron-parser'

export function nextRuns(expr: string, count: number, from?: Date): Date[] {
  const it = parser.parseExpression(expr, from ? { currentDate: from } : undefined)
  return Array.from({ length: count }, () => it.next().toDate())
}
```

（cron-parser v4 的导入形态是 `import parser from 'cron-parser'` + `parser.parseExpression`；若 typecheck 报 default export 问题，改 `import { parseExpression } from 'cron-parser'`，以装出来的类型为准。）

- [ ] **Step 4: 确认通过**

```bash
pnpm --filter @lele/ui test -- "time|cron"   # 5 passed
```

- [ ] **Step 5: 两个 UI**

`tools/date-time/meta.ts`：id `date-time`，name `时间戳转换 / Timestamp`，category `time`，icon `🕐`，keywords `['timestamp', 'unix', 'date', '时间戳', '日期']`。

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '../../clipboard'
import { normalizeTs, tsToStrings } from './time'

const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onBeforeUnmount(() => clearInterval(timer))

const tsInput = ref('')
const tsResult = computed(() => {
  if (!tsInput.value.trim()) return null
  try {
    const r = tsToStrings(normalizeTs(tsInput.value))
    return { iso: r.iso, local: r.local, error: '' }
  } catch (e) {
    return { iso: '', local: '', error: e instanceof Error ? e.message : String(e) }
  }
})

const dateInput = ref('')
const dateResult = computed(() => {
  if (!dateInput.value.trim()) return null
  const d = new Date(dateInput.value)
  if (Number.isNaN(d.getTime())) return { s: '', ms: '', error: '无法解析的日期' }
  return { s: String(Math.floor(d.getTime() / 1000)), ms: String(d.getTime()), error: '' }
})
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <span class="hint">当前：</span><code>{{ Math.floor(now / 1000) }}</code>
      <span class="hint">(s)</span><code>{{ now }}</code><span class="hint">(ms)</span>
      <code>{{ new Date(now).toLocaleString() }}</code>
      <button class="btn" @click="copyText(String(Math.floor(now / 1000)))">⧉s</button>
    </div>
    <hr style="width: 100%; border-color: var(--border)" />
    <div class="row">
      <input v-model="tsInput" class="input grow" placeholder="时间戳（秒或毫秒）→ 日期" />
    </div>
    <p v-if="tsResult" :class="tsResult.error ? 'error' : ''">
      <template v-if="!tsResult.error">ISO: <code>{{ tsResult.iso }}</code>　本地: <code>{{ tsResult.local }}</code></template>
      <template v-else>{{ tsResult.error }}</template>
    </p>
    <div class="row">
      <input v-model="dateInput" class="input grow" placeholder="日期（如 2026-06-05 12:00:00）→ 时间戳" />
    </div>
    <p v-if="dateResult" :class="dateResult.error ? 'error' : ''">
      <template v-if="!dateResult.error">秒: <code>{{ dateResult.s }}</code>　毫秒: <code>{{ dateResult.ms }}</code></template>
      <template v-else>{{ dateResult.error }}</template>
    </p>
  </div>
</template>
```

`tools/cron/meta.ts`：id `cron`，name `Cron 表达式 / Cron Parser`，category `time`，icon `⏰`，keywords `['cron', 'crontab', '定时']`。

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { nextRuns } from './cron'

const expr = ref('0 9 * * 1-5')
const result = computed(() => {
  try {
    return { runs: nextRuns(expr.value, 10), error: '' }
  } catch (e) {
    return { runs: [], error: e instanceof Error ? e.message : String(e) }
  }
})
const PRESETS: [string, string][] = [
  ['* * * * *', '每分钟'],
  ['0 * * * *', '每小时整点'],
  ['0 9 * * 1-5', '工作日 9 点'],
  ['0 0 1 * *', '每月 1 号零点'],
]
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <input v-model="expr" class="input grow" spellcheck="false" placeholder="分 时 日 月 周" />
    </div>
    <div class="row">
      <button v-for="[p, label] in PRESETS" :key="p" class="btn" @click="expr = p">{{ label }}</button>
    </div>
    <p class="error">{{ result.error }}</p>
    <table v-if="result.runs.length">
      <tr v-for="(d, i) in result.runs" :key="i">
        <td class="hint">#{{ i + 1 }}</td>
        <td><code>{{ d.toLocaleString() }}</code></td>
      </tr>
    </table>
  </div>
</template>
```

- [ ] **Step 6: 注册 + 验证 + 提交**

```bash
pnpm --filter @lele/ui test && pnpm typecheck
git add -A && git commit -m "feat: timestamp and cron expression tools"
```

---

### Task 19: 工具 ×2 — 颜色工具（TDD）/ HTTP 状态码表

**Files:**
- Create: `packages/ui/src/tools/color-tools/{meta.ts,Tool.vue,color.ts,color.test.ts}`
- Create: `packages/ui/src/tools/http-status/{meta.ts,Tool.vue,data.ts}`
- Modify: `packages/ui/src/tools/index.ts`

- [ ] **Step 1: color 失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { hexToRgb, rgbToHex, rgbToHsl } from './color'

describe('color conversions', () => {
  it('hex ↔ rgb', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 })
    expect(hexToRgb('f80')).toEqual({ r: 255, g: 136, b: 0 }) // 短格式
    expect(rgbToHex({ r: 255, g: 128, b: 0 })).toBe('#ff8000')
  })
  it('rgb → hsl', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 })
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 })
  })
  it('invalid hex throws', () => {
    expect(() => hexToRgb('#zzz')).toThrow()
  })
})
```

- [ ] **Step 2: 确认失败**

```bash
pnpm --filter @lele/ui test -- color   # FAIL
```

- [ ] **Step 3: 实现 color.ts**

```ts
export interface Rgb { r: number; g: number; b: number }
export interface Hsl { h: number; s: number; l: number }

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error('非法 HEX 颜色')
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const p = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${p(r)}${p(g)}${p(b)}`
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}
```

- [ ] **Step 4: 确认通过**

```bash
pnpm --filter @lele/ui test -- color   # 3 passed
```

- [ ] **Step 5: 两个 UI + http 数据**

`tools/color-tools/meta.ts`：id `color-tools`，name `颜色工具 / Color Tools`，category `misc`，icon `🎨`，keywords `['color', 'hex', 'rgb', 'hsl', '颜色']`。

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { copyText } from '../../clipboard'
import { hexToRgb, rgbToHex, rgbToHsl } from './color'

const hex = ref('#5b8def')
const parsed = computed(() => {
  try {
    const rgb = hexToRgb(hex.value)
    const hsl = rgbToHsl(rgb)
    return {
      hex: rgbToHex(rgb),
      rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
      error: '',
    }
  } catch (e) {
    return { hex: '', rgb: '', hsl: '', error: e instanceof Error ? e.message : String(e) }
  }
})
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <input v-model="hex" class="input" style="width: 130px" spellcheck="false" />
      <input type="color" :value="parsed.hex || '#000000'" @input="hex = ($event.target as HTMLInputElement).value" />
      <span class="error">{{ parsed.error }}</span>
    </div>
    <div v-if="!parsed.error" class="swatch" :style="{ background: parsed.hex }" />
    <table v-if="!parsed.error">
      <tr v-for="[label, v] in [['HEX', parsed.hex], ['RGB', parsed.rgb], ['HSL', parsed.hsl]]" :key="label">
        <td class="hint">{{ label }}</td>
        <td><code>{{ v }}</code></td>
        <td><button class="btn" @click="copyText(v)">⧉</button></td>
      </tr>
    </table>
  </div>
</template>

<style scoped>
.swatch { width: 220px; height: 80px; border-radius: 8px; border: 1px solid var(--border); }
table td { padding: 4px 12px 4px 0; }
</style>
```

`tools/http-status/data.ts`（节选结构，全量数据照 MDN 补齐 1xx-5xx 常用 ~60 条；中文描述可对照 QT 版 `modules/http-status-code/` 里的文案抄）：

```ts
export interface HttpStatus { code: number; name: string; zh: string }

export const HTTP_STATUSES: HttpStatus[] = [
  { code: 100, name: 'Continue', zh: '继续：客户端应继续发送请求体' },
  { code: 101, name: 'Switching Protocols', zh: '切换协议（如升级到 WebSocket）' },
  { code: 200, name: 'OK', zh: '成功' },
  { code: 201, name: 'Created', zh: '已创建' },
  { code: 204, name: 'No Content', zh: '成功但无返回体' },
  { code: 301, name: 'Moved Permanently', zh: '永久重定向' },
  { code: 302, name: 'Found', zh: '临时重定向' },
  { code: 304, name: 'Not Modified', zh: '未修改，走缓存' },
  { code: 400, name: 'Bad Request', zh: '请求语法错误' },
  { code: 401, name: 'Unauthorized', zh: '未认证' },
  { code: 403, name: 'Forbidden', zh: '已认证但无权限' },
  { code: 404, name: 'Not Found', zh: '资源不存在' },
  { code: 429, name: 'Too Many Requests', zh: '请求过于频繁' },
  { code: 500, name: 'Internal Server Error', zh: '服务器内部错误' },
  { code: 502, name: 'Bad Gateway', zh: '网关收到上游非法响应' },
  { code: 503, name: 'Service Unavailable', zh: '服务不可用（过载/维护）' },
  { code: 504, name: 'Gateway Timeout', zh: '网关等上游超时' },
  // …补齐 1xx-5xx 全部常用码（103/202/203/205/206/300/303/307/308/402/405-418/422/425/426/428/431/451/501/505/507/508/511）
]
```

`tools/http-status/meta.ts`：id `http-status`，name `HTTP 状态码 / HTTP Status Codes`，category `misc`，icon `🌐`，keywords `['http', 'status', '404', '状态码']`。

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { HTTP_STATUSES } from './data'

const q = ref('')
const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return HTTP_STATUSES
  return HTTP_STATUSES.filter(
    (x) => String(x.code).startsWith(s) || x.name.toLowerCase().includes(s) || x.zh.includes(s),
  )
})
function color(code: number): string {
  if (code < 200) return '#888'
  if (code < 300) return '#3a9e4f'
  if (code < 400) return '#c9a23c'
  if (code < 500) return '#d4763b'
  return '#cc4f44'
}
</script>

<template>
  <div class="tool-page">
    <input v-model="q" class="input" placeholder="搜索：404 / not found / 重定向…" />
    <div class="grow" style="overflow: auto">
      <table style="width: 100%">
        <tr v-for="x in list" :key="x.code">
          <td style="width: 60px"><b :style="{ color: color(x.code) }">{{ x.code }}</b></td>
          <td style="width: 220px"><code>{{ x.name }}</code></td>
          <td class="hint">{{ x.zh }}</td>
        </tr>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 6: 注册 + 全量回归 + 提交**

tools/index.ts 此时应注册全部 15 个工具。

```bash
pnpm --filter @lele/ui test && pnpm typecheck && pnpm dev
# 导航 5 个分类齐全；搜索"密码"能过滤出随机密码；15 个工具全部能开、能用
git add -A && git commit -m "feat: color tools and http status table; first 15 tools complete"
```

---

### Task 20: 打包（electron-builder + 图标）

**Files:**
- Create: `apps/desktop/electron-builder.yml`, `apps/desktop/build/icon.png`(及衍生)

- [ ] **Step 1: 图标**

```bash
mkdir -p apps/desktop/build
ls /Users/a9/Projects/lele-tools/resources/ | grep -iE "icon|logo|png|icns"
```

找到 Qt 版应用图标（如 `resources/icon.png` 或 `.icns`），拷为 `apps/desktop/build/icon.png`（需 ≥512×512；不够就 `sips -z 1024 1024 in.png --out icon.png` 放大或先用 1024 纯色底 + emoji 占位图，发版前再换）。electron-builder 会从 png 自动生成各平台格式。

- [ ] **Step 2: electron-builder.yml**

```yaml
appId: com.duhbbx.leletools
productName: Lele Tools
directories:
  buildResources: build
  output: release
files:
  - out/**
  - package.json
asarUnpack:
  - '**/*.node'
npmRebuild: true

mac:
  category: public.app-category.developer-tools
  target:
    - dmg
    - zip
win:
  target:
    - nsis
    - zip
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
linux:
  category: Utility
  target:
    - deb
    - rpm
    - AppImage
```

- [ ] **Step 3: 出包验证 + 提交**

```bash
export PYTHON=python3.9
pnpm --filter @lele/desktop pack   # --dir 模式，最快
# 期望：release/mac-arm64/Lele Tools.app 存在；打开它：窗口正常、工具可用、
#   设置写入后重启保留（验证打包后 better-sqlite3 原生模块加载 OK）
git add -A && git commit -m "build: electron-builder packaging config"
```

如原生模块报 NODE_MODULE_VERSION 不匹配：`pnpm --filter @lele/desktop rebuild:native` 后重试。

---

### Task 21: 收尾（README + 踩坑文档 + 全量回归）

**Files:**
- Modify: `README.md`
- Create: `docs/踩坑与要点.md`

- [ ] **Step 1: README 完整版**

充实 README.md：项目简介（一句话 + 跟 Qt 版的关系）、功能列表（15 工具按分类）、AI 助手说明（支持的 6 个 provider）、技术栈、开发命令（install / dev / test / dist，注明 PYTHON=python3.9）、目录结构（apps/packages 三行）、License MIT。

- [ ] **Step 2: docs/踩坑与要点.md 初始条目**

```markdown
# 踩坑与要点

## Monaco
- 中文 NLS 必须用 vite `resolveId` 插件把 `monaco-editor/esm/vs/nls.js` 换成 shim，
  且 monaco 要进 `optimizeDeps.exclude`——alias 截不到 monaco 内部相对 import（搬自 SkylerX）。

## better-sqlite3
- 本机 node-gyp 编译用 `PYTHON=python3.9`（3.14 没 distutils）。
- 打包时 `asarUnpack: '**/*.node'`，否则原生模块加载失败。

## AI
- 渲染层直发 OpenAI/DeepSeek 会被 CORS 卡（只有 Anthropic 开放浏览器直连），
  统一走主进程 `ai:fetch`/`ai:stream` IPC 代理。

## pnpm workspace
- `@lele/ui` 是 TS 源码包：desktop 的 vite 把它放进 `optimizeDeps.exclude`，
  主进程侧 `externalizeDepsPlugin({ exclude: ['@lele/shared-types'] })`。
```

- [ ] **Step 3: 全量回归 + 提交**

```bash
pnpm typecheck && pnpm test && pnpm lint
# 三个全绿；lint 报风格问题就 pnpm format 后复查
git add -A && git commit -m "docs: readme and pitfalls notes"
```

---

## 完成标准

- `pnpm dev`：左导航 5 分类 15 工具 + 搜索 + 最近使用；多 Tab 状态保持；设置（语言/主题/AI）持久化；AI 面板流式对话 + 历史。
- `pnpm test`：全部纯逻辑单测绿（xml/base64/进制/字数/加解密/密码/时间/cron/颜色）。
- `pnpm --filter @lele/desktop pack`：出包可运行，sqlite 持久化正常。
- 官网与部署 → 下一份计划。
