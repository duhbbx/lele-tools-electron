# lele-tools-electron 官网 + 部署实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建 `apps/website` VitePress 官网（中文根 + en/es/fr/ja/ko/pt 七语），部署到 `https://lele.skyler.uno`（共享服务器 101.132.20.134，只新增、不动现有配置）。

**Architecture:** 结构照搬 db-tool 官网（`/Users/a9/Projects/db-tool/apps/website`，下称 **DBW**）：`.vitepress/config.ts` 的 SEO 机制（sitemap/hreflang/JSON-LD/canonical）通用直搬；`.vitepress/i18n.ts` 机制照搬但标签全新（我们页面少得多）；内容以 Qt 版官网（`/Users/a9/Projects/lele-tools/website`，下称 **QTW**）中文文案为底稿改写。部署沿用 DBW 的 `deploy.sh`（rsync + 服务器侧 chown/chmod + nginx reload + IndexNow）。

**Tech Stack:** VitePress 1.x / Vue 3 / TS。部署：rsync + ssh、nginx、certbot。

**页面结构（每个 locale 同构 6 页）：** `index.md`（首页 hero）、`tools.md`（功能一览）、`download.md`（下载）、`docs/getting-started.md`（快速上手）、`docs/faq.md`（FAQ）、`roadmap.md`。

**通则：** 拷贝 DBW 文件时删公司版权头；`SkylerX/skylerx` → `Lele Tools/lele`；commit message 英文、不带 Co-Authored-By。**服务器红线（来自共享机约定）：不碰 ufw、不改既有 nginx server block、不动其它站点 webroot。**

---

### Task W1: apps/website 脚手架（VitePress 跑起来，仅中文首页）

**Files:**
- Create: `apps/website/package.json`, `apps/website/tsconfig.json`, `apps/website/.gitignore`, `apps/website/index.md`
- Copy+adapt: DBW `.vitepress/config.ts` → `apps/website/.vitepress/config.ts`
- Create: `apps/website/.vitepress/i18n.ts`（完整 7 locale，见 Task W1 Step 3）
- Copy: DBW `.vitepress/theme/style.css` → 同路径；Create `apps/website/.vitepress/theme/index.ts`
- Modify: 根 `package.json`（加 scripts）

- [ ] **Step 1: package.json + tsconfig + .gitignore**

`apps/website/package.json`：

```json
{
  "name": "@lele/website",
  "version": "0.0.0",
  "private": true,
  "description": "乐乐的工具箱官网（VitePress）",
  "type": "module",
  "scripts": {
    "dev": "vitepress dev",
    "build": "vitepress build",
    "preview": "vitepress preview"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "typescript": "^5.7.3",
    "vitepress": "^1.5.0",
    "vue": "^3.5.13"
  }
}
```

`apps/website/tsconfig.json`：`cp /Users/a9/Projects/db-tool/apps/website/tsconfig.json apps/website/`（如有 @db-tool 引用改掉；通常没有）。

`apps/website/.gitignore`：

```
.vitepress/dist/
.vitepress/cache/
.env.deploy
```

根 `package.json` scripts 追加：

```json
"dev:website": "pnpm --filter @lele/website dev",
"build:website": "pnpm --filter @lele/website build",
"preview:website": "pnpm --filter @lele/website preview"
```

注意：`@lele/website` 没有 `typecheck` 脚本，根 `pnpm -r typecheck` 会自动跳过——无需处理。

- [ ] **Step 2: 拷 config.ts 并适配**

```bash
mkdir -p apps/website/.vitepress/theme apps/website/.vitepress/components apps/website/public apps/website/docs
cp /Users/a9/Projects/db-tool/apps/website/.vitepress/config.ts apps/website/.vitepress/
```

适配点（其余 SEO 机制 transformHead/sitemap/LOCALE_PREFIXES 原样保留）：
1. 删公司头注释；文件头注释改为 Lele Tools 官网说明。
2. `SITE_HOSTNAME = 'https://lele.skyler.uno'`。
3. `title: '乐乐的工具箱'`（顶层）；locale 级 title 由 i18n.ts 提供。
4. i18n.ts 的 import 保持同名（我们的 i18n.ts 导出同名符号：`ZH/EN/ES/FR/JA/KO/PT/LOCALE_META/makeLocaleHead/makeThemeConfig`）。
5. 如 config.ts 引用了我们不搬的组件/页面路径（databases 之类），按 typecheck/build 报错清理。

- [ ] **Step 3: 写 i18n.ts（完整 7 locale）**

机制照 DBW（接口 + 每语言对象 + makeThemeConfig 工厂），但标签是我们的 6 页结构。完整代码：

```ts
/**
 * 多语言 nav / sidebar / UI 标签集中维护。内容(markdown)在各 locale 子目录。
 * 加新语言：1) 加 LocaleLabels 对象 2) config.ts locales 注册 3) 建目录翻译 markdown。
 */
import type { DefaultTheme, HeadConfig } from 'vitepress'

export interface LocaleLabels {
  // Nav
  home: string
  tools: string
  download: string
  docs: string
  roadmap: string
  github: string
  // Sidebar
  gettingStarted: string
  faq: string
  // UI
  editLink: string
  lastUpdated: string
}

const LABELS: Record<string, LocaleLabels> = {
  'zh-CN': {
    home: '首页', tools: '功能一览', download: '下载', docs: '文档', roadmap: '路线图', github: 'GitHub',
    gettingStarted: '快速上手', faq: '常见问题',
    editLink: '在 GitHub 上编辑此页', lastUpdated: '最近更新',
  },
  'en-US': {
    home: 'Home', tools: 'Tools', download: 'Download', docs: 'Docs', roadmap: 'Roadmap', github: 'GitHub',
    gettingStarted: 'Getting Started', faq: 'FAQ',
    editLink: 'Edit this page on GitHub', lastUpdated: 'Last updated',
  },
  'es-ES': {
    home: 'Inicio', tools: 'Herramientas', download: 'Descargar', docs: 'Documentación', roadmap: 'Hoja de ruta', github: 'GitHub',
    gettingStarted: 'Primeros pasos', faq: 'Preguntas frecuentes',
    editLink: 'Editar esta página en GitHub', lastUpdated: 'Última actualización',
  },
  'fr-FR': {
    home: 'Accueil', tools: 'Outils', download: 'Télécharger', docs: 'Documentation', roadmap: 'Feuille de route', github: 'GitHub',
    gettingStarted: 'Premiers pas', faq: 'FAQ',
    editLink: 'Modifier cette page sur GitHub', lastUpdated: 'Dernière mise à jour',
  },
  'ja-JP': {
    home: 'ホーム', tools: 'ツール一覧', download: 'ダウンロード', docs: 'ドキュメント', roadmap: 'ロードマップ', github: 'GitHub',
    gettingStarted: 'クイックスタート', faq: 'よくある質問',
    editLink: 'GitHub でこのページを編集', lastUpdated: '最終更新',
  },
  'ko-KR': {
    home: '홈', tools: '도구 목록', download: '다운로드', docs: '문서', roadmap: '로드맵', github: 'GitHub',
    gettingStarted: '시작하기', faq: '자주 묻는 질문',
    editLink: 'GitHub에서 이 페이지 편집', lastUpdated: '마지막 업데이트',
  },
  'pt-BR': {
    home: 'Início', tools: 'Ferramentas', download: 'Baixar', docs: 'Documentação', roadmap: 'Roteiro', github: 'GitHub',
    gettingStarted: 'Primeiros passos', faq: 'Perguntas frequentes',
    editLink: 'Editar esta página no GitHub', lastUpdated: 'Última atualização',
  },
}

export const LOCALE_META: Record<string, { lang: string; label: string; title: string; description: string }> = {
  'zh-CN': { lang: 'zh-CN', label: '简体中文', title: '乐乐的工具箱', description: '开源跨平台开发者工具箱：格式化、编解码、生成器、时间工具，内置 AI 助手。' },
  'en-US': { lang: 'en-US', label: 'English', title: 'Lele Tools', description: 'Open-source cross-platform developer toolbox: formatters, encoders, generators, time utilities, with a built-in AI assistant.' },
  'es-ES': { lang: 'es-ES', label: 'Español', title: 'Lele Tools', description: 'Caja de herramientas de código abierto y multiplataforma para desarrolladores, con asistente de IA integrado.' },
  'fr-FR': { lang: 'fr-FR', label: 'Français', title: 'Lele Tools', description: "Boîte à outils open source et multiplateforme pour développeurs, avec assistant IA intégré." },
  'ja-JP': { lang: 'ja-JP', label: '日本語', title: 'Lele Tools', description: 'オープンソースのクロスプラットフォーム開発者ツールボックス。AI アシスタント内蔵。' },
  'ko-KR': { lang: 'ko-KR', label: '한국어', title: 'Lele Tools', description: '오픈소스 크로스플랫폼 개발자 도구 모음. AI 어시스턴트 내장.' },
  'pt-BR': { lang: 'pt-BR', label: 'Português', title: 'Lele Tools', description: 'Caixa de ferramentas de código aberto e multiplataforma para desenvolvedores, com assistente de IA integrado.' },
}

const REPO = 'https://github.com/duhbbx/lele-tools-electron'

/** 生成某 locale 的 themeConfig（nav + sidebar + UI 文案） */
export function makeThemeConfig(localeKey: string, prefix: string): DefaultTheme.Config {
  const L = LABELS[localeKey]
  const p = prefix // '' or '/en' etc.
  return {
    nav: [
      { text: L.home, link: `${p}/` },
      { text: L.tools, link: `${p}/tools` },
      { text: L.download, link: `${p}/download` },
      { text: L.docs, link: `${p}/docs/getting-started` },
      { text: L.roadmap, link: `${p}/roadmap` },
    ],
    sidebar: {
      [`${p}/docs/`]: [
        { text: L.gettingStarted, link: `${p}/docs/getting-started` },
        { text: L.faq, link: `${p}/docs/faq` },
      ],
    },
    socialLinks: [{ icon: 'github', link: REPO }],
    editLink: { pattern: `${REPO}/edit/dev/apps/website/:path`, text: L.editLink },
    lastUpdated: { text: L.lastUpdated },
  }
}

/** 每 locale 的 head 标签（og:locale 等）；照 DBW 同名导出便于 config.ts 复用 */
export function makeLocaleHead(localeKey: string): HeadConfig[] {
  const meta = LOCALE_META[localeKey]
  return [
    ['meta', { property: 'og:locale', content: meta.lang.replace('-', '_') }],
    ['meta', { property: 'og:site_name', content: meta.title }],
  ]
}

/** config.ts 里 locales 注册用的便捷对象（key 与 DBW 一致） */
function localeEntry(localeKey: string, prefix: string) {
  const meta = LOCALE_META[localeKey]
  return {
    label: meta.label,
    lang: meta.lang,
    title: meta.title,
    description: meta.description,
    themeConfig: makeThemeConfig(localeKey, prefix),
    head: makeLocaleHead(localeKey),
  }
}

export const ZH = localeEntry('zh-CN', '')
export const EN = localeEntry('en-US', '/en')
export const ES = localeEntry('es-ES', '/es')
export const FR = localeEntry('fr-FR', '/fr')
export const JA = localeEntry('ja-JP', '/ja')
export const KO = localeEntry('ko-KR', '/ko')
export const PT = localeEntry('pt-BR', '/pt')
```

注意：DBW config.ts 实际消费这些导出的方式以它源码为准——如它对 `ZH/EN/...` 的形状有额外字段要求（如 `link`），对照报错补齐 `localeEntry`，**不要**反向大改 config.ts。

- [ ] **Step 4: theme/index.ts + style.css + 临时首页**

```bash
cp /Users/a9/Projects/db-tool/apps/website/.vitepress/theme/style.css apps/website/.vitepress/theme/
```

`apps/website/.vitepress/theme/index.ts`（组件 Task W3 才搬，先最小化）：

```ts
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import './style.css'

export default {
  extends: DefaultTheme,
} satisfies Theme
```

`apps/website/index.md` 临时占位：

```markdown
---
layout: home
hero:
  name: 乐乐的工具箱
  tagline: 开源跨平台开发者工具箱（建设中）
---
```

- [ ] **Step 5: 验证 + 提交**

```bash
pnpm install
pnpm build:website   # 应成功产出 .vitepress/dist（其它 locale 目录还没建，config 里 locales 已注册会因缺 index.md 报 dead link？—— config.ts 有 ignoreDeadLinks: true；若 build 因缺 locale 目录失败，临时给 en/es/fr/ja/ko/pt 各建一个最小 index.md（Task W4/W5 会覆盖），内容一行 hero 即可）
pnpm dev:website     # 手测 http://localhost:5173 渲染（注意本机 Privoxy：curl 验证要 --noproxy '*'）
git add -A && git commit -m "feat(website): vitepress scaffold with 7-locale shell"
```

---

### Task W2: 中文内容 6 页

**Files:**
- Rewrite: `apps/website/index.md`
- Create: `apps/website/tools.md`, `apps/website/download.md`, `apps/website/docs/getting-started.md`, `apps/website/docs/faq.md`, `apps/website/roadmap.md`

**底稿来源：** QTW `index.md / features.md / install.md / faq.md`（中文现成文案，按 Electron 版现实改写）；工具清单的权威来源是 `packages/ui/src/tools/index.ts` + 各 meta.ts（15 个工具、5 分类）；AI 说明对照 `packages/ui/src/settings.ts` 的 6 个 provider。

- [ ] **Step 1: index.md（hero + features）**

```markdown
---
layout: home
title: 乐乐的工具箱 — 开源跨平台开发者工具箱
hero:
  name: 乐乐的工具箱
  text: 开源 · 跨平台 · 内置 AI
  tagline: 15+ 开发者常用工具集于一桌面应用：格式化、编解码、生成器、时间工具。Windows / macOS / Linux。
  image:
    src: /logo.png
    alt: Lele Tools
  actions:
    - theme: brand
      text: 立即下载
      link: /download
    - theme: alt
      text: 快速上手
      link: /docs/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/duhbbx/lele-tools-electron
features:
  - icon: 🧰
    title: 15+ 实用工具
    details: JSON/XML/YAML 格式化、Base64、进制转换、正则测试、UUID、随机密码、二维码、时间戳、Cron、颜色工具……持续增加中。
  - icon: 🤖
    title: 内置 AI 助手
    details: 支持 Claude、OpenAI、DeepSeek、Grok、Ollama 本地模型等 6 种服务商，任意工具页一键唤出，对话历史本地保存。
  - icon: 🖥️
    title: 真正跨平台
    details: 基于 Electron + Vue3，Windows / macOS / Linux 三端一致体验，深色浅色主题，中英双语。
  - icon: 🔓
    title: 开源免费
    details: MIT 协议，代码完全开放。数据全部存在本地 SQLite，不上传任何内容。
---
```

- [ ] **Step 2: tools.md**

以 `packages/ui/src/tools/index.ts` 注册顺序为准，按 5 分类写表格（分类标题用 registry.ts 的 CATEGORY_LABEL 中文）。每工具一行：名称 + 一句话说明（取各 meta.ts 的 desc.zh，可润色）。文件头：

```markdown
# 功能一览

15 个工具，按分类列出。每个工具独立 Tab 打开，状态互不干扰。

## 编码 & 格式化
| 工具 | 说明 |
|------|------|
| JSON 格式化 | 格式化 / 压缩 / 校验 JSON，Monaco 编辑器 |
...
```

（执行时逐个 meta.ts 读 desc 填全 15 行；分类顺序 format → text → generator → time → misc。）

- [ ] **Step 3: download.md**

现实：**还没有正式 release**。诚实写法：

```markdown
# 下载

> ⏳ 首个正式版本正在准备中。可先从源码构建，或关注 [GitHub Releases](https://github.com/duhbbx/lele-tools-electron/releases) 获取后续版本。

## 支持平台

| 平台 | 格式 |
|------|------|
| Windows | `.exe` (NSIS) / `.zip` |
| macOS | `.dmg` / `.zip` |
| Linux | `.deb` / `.rpm` / `.AppImage` |

## 从源码构建

```bash
git clone https://github.com/duhbbx/lele-tools-electron.git
cd lele-tools-electron
pnpm install
pnpm dist   # 产物在 apps/desktop/release/
```

macOS 提示"已损坏"的处理见 [常见问题](/docs/faq)。
```

- [ ] **Step 4: docs/getting-started.md**

结构：安装（指向 download）→ 界面布局（左导航/搜索/最近使用、右多 Tab、右侧 AI 面板各一段）→ 配置 AI（设置 → 选服务商 → 填 Key/BaseURL → 测试连接；Ollama 本地无需 Key）→ 加新工具(开发者)（meta.ts + Tool.vue + 注册一行，3 步代码示例照 README 的写法）。中文 300-500 字 + 代码块。

- [ ] **Step 5: docs/faq.md**

从 QTW `faq.md` 取通用条目改写（macOS "已损坏" `xattr -dr com.apple.quarantine`、Windows 缺 VC++ 运行库——Electron 版其实不需要，删；保留 macOS 公证说明），新增 Electron 版特有：AI 连不上（检查 Key/BaseURL/代理；国内访问 OpenAI 需自备网络）、数据存哪（`userData/lele.db`，给三平台路径）、为什么用 Electron 重写（一段：Qt 版维护成本、Web 技术生态、AI 集成便利）。

- [ ] **Step 6: roadmap.md**

```markdown
# 路线图

## 已完成（v0.1）
- 15 个纯前端工具（5 分类）
- 全局 AI 助手（6 服务商 + 流式对话 + 本地历史）
- Monaco 编辑器中文界面、明暗主题、中英双语
- better-sqlite3 本地持久化

## 进行中
- 首个正式 Release（三平台安装包 + GitHub Actions CI）

## 计划中（按 Qt 版功能逐步迁移）
- Node 系统工具批：文件哈希、文件搜索、Hosts 编辑器、Ping、端口扫描、系统信息
- 网络工具批：HTTP 客户端、WHOIS、IP 查询
- 有状态工具：记事本、Todo（复用 SQLite 存储）
- 图像工具批：图片压缩、格式转换、水印
- 自动更新（electron-updater）

> 顺序与优先级以 [GitHub Issues](https://github.com/duhbbx/lele-tools-electron/issues) 为准。
```

- [ ] **Step 7: 验证 + 提交**

```bash
pnpm build:website && pnpm preview:website  # 手测各页渲染、nav/sidebar 链接通
git add -A && git commit -m "feat(website): zh content for all six pages"
```

---

### Task W3: 组件搬运 + 静态资源

**Files:**
- Copy+adapt: DBW `.vitepress/components/{FeatureGrid.vue,Lightbox.vue,DownloadButton.vue,DownloadMatrix.vue,downloadSource.ts}` → 同路径
- Modify: `apps/website/.vitepress/theme/index.ts`
- Create: `apps/website/public/logo.png`, `apps/website/public/favicon.ico`

- [ ] **Step 1: 静态资源**

```bash
cp apps/desktop/build/icon.png apps/website/public/logo.png
sips -z 64 64 apps/desktop/build/icon.png --out /tmp/fav.png && sips -s format ico /tmp/fav.png --out apps/website/public/favicon.ico 2>/dev/null || cp /tmp/fav.png apps/website/public/favicon.png
```

（sips 不支持 ico 输出就用 favicon.png，config.ts head 里 link rel=icon 指向它；对照 DBW config 的 favicon 写法。）

- [ ] **Step 2: 组件搬运**

```bash
cp /Users/a9/Projects/db-tool/apps/website/.vitepress/components/{FeatureGrid.vue,Lightbox.vue,DownloadButton.vue,DownloadMatrix.vue,downloadSource.ts} apps/website/.vitepress/components/
```

适配：删公司头；`downloadSource.ts` 里 GitHub repo 常量改 `duhbbx/lele-tools-electron`（读源码找 repo/owner 常量与 release asset 命名匹配规则，按我们 electron-builder 产物名调整：`Lele-Tools-<ver>-mac-arm64.dmg` 等——具体命名等首个 release 出来才定，先保守按 electron-builder 默认 artifactName 规则写，挂不上就显示"暂无版本"兜底，确认组件有空态）。**不搬** DatabaseGrid.vue / HeroExtra.vue。

`theme/index.ts` 更新：

```ts
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import DownloadButton from '../components/DownloadButton.vue'
import DownloadMatrix from '../components/DownloadMatrix.vue'
import FeatureGrid from '../components/FeatureGrid.vue'
import Lightbox from '../components/Lightbox.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, { 'layout-bottom': () => h(Lightbox) })
  },
  enhanceApp({ app }) {
    app.component('DownloadButton', DownloadButton)
    app.component('DownloadMatrix', DownloadMatrix)
    app.component('FeatureGrid', FeatureGrid)
  },
} satisfies Theme
```

download.md 在"支持平台"表格上方加 `<DownloadMatrix />`（组件空态显示无版本即可）。

- [ ] **Step 3: 验证 + 提交**

```bash
pnpm build:website   # 组件编译过、无死链
git add -A && git commit -m "feat(website): port download/feature components and assets"
```

---

### Task W4: 英文翻译（/en 全镜像）

**Files:**
- Create: `apps/website/en/{index.md,tools.md,download.md,roadmap.md}`, `apps/website/en/docs/{getting-started.md,faq.md}`

- [ ] **Step 1: 翻译 6 页**

逐页翻译 zh 内容为地道英文（不是逐字直译；hero 文案要营销感）。frontmatter 里的内链全部加 `/en` 前缀（`link: /en/download` 等）；正文内链同理。`hero.name` 用 `Lele Tools`。

- [ ] **Step 2: 验证 + 提交**

```bash
pnpm build:website   # /en/ 各页产出；nav 切语言互通
git add -A && git commit -m "feat(website): english translation"
```

---

### Task W5: 其余 5 语翻译（es/fr/ja/ko/pt）

**Files:**
- Create: `apps/website/{es,fr,ja,ko,pt}/{index.md,tools.md,download.md,roadmap.md}` + 各自 `docs/{getting-started.md,faq.md}`（共 30 文件）

- [ ] **Step 1: 翻译**

以 en 版为源逐语翻译（质量基线：母语者读着自然；技术名词保留英文如 JSON/Base64/Cron）。每语言内链加对应前缀 `/es` `/fr` `/ja` `/ko` `/pt`。

- [ ] **Step 2: 验证 + 提交**

```bash
pnpm build:website   # 7 locale 全部产出；语言切换器 7 项齐
git add -A && git commit -m "feat(website): es/fr/ja/ko/pt translations"
```

---

### Task W6: deploy.sh + IndexNow + env 模板

**Files:**
- Copy+adapt: DBW `deploy.sh` → `apps/website/deploy.sh`；DBW `scripts/indexnow.mjs` → `apps/website/scripts/indexnow.mjs`
- Create: `apps/website/.env.deploy.example`, `apps/website/public/<indexnow-key>.txt`

- [ ] **Step 1: deploy.sh**

```bash
cp /Users/a9/Projects/db-tool/apps/website/deploy.sh apps/website/
```

适配（逻辑零改动，只换标识）：
1. 注释里 SKYLERX → LELE；env 变量名 `SKYLERX_DEPLOY_*` → `LELE_WEB_DEPLOY_*`（**不要**用 `LELE_DEPLOY_*`——Qt 版仓库已用该前缀指向 lele-tools.skyler.uno，避免用户 shell 里全局 export 时串台）。
2. `pnpm --filter @db-tool/website build` → `pnpm --filter @lele/website build`。
3. 脚本内路径引用 `apps/website` 不变。

- [ ] **Step 2: .env.deploy.example**

```bash
# Lele Tools 官网 deploy 目标（cp 为 .env.deploy 后填值；已 gitignore）
LELE_WEB_DEPLOY_HOST=
LELE_WEB_DEPLOY_USER=root
LELE_WEB_DEPLOY_WEBROOT=
LELE_WEB_DEPLOY_DOMAIN=
# 可选：无 ssh-key 时 sshpass 用
# SSHPASS=
```

- [ ] **Step 3: indexnow.mjs**

```bash
mkdir -p apps/website/scripts
cp /Users/a9/Projects/db-tool/apps/website/scripts/indexnow.mjs apps/website/scripts/
```

适配：`HOST = 'lele.skyler.uno'`；`KEY` 生成新值 `openssl rand -hex 16`，并写 `apps/website/public/<KEY>.txt`（内容就是 KEY 本身，IndexNow 协议要求）。

- [ ] **Step 4: 验证 + 提交**

```bash
bash -n apps/website/deploy.sh        # 语法检查
pnpm build:website && ls apps/website/.vitepress/dist/*.txt   # key 文件进产物
git add -A && git commit -m "feat(website): deploy script and indexnow"
```

---

### Task W7: 服务器开通（DNS + nginx + SSL）— 谨慎任务

**目标：** `lele.skyler.uno` 可 HTTPS 访问，webroot `/var/www/lele`。**只新增文件，不改任何既有配置。**

- [ ] **Step 1: DNS 检查**

```bash
dig +short lele.skyler.uno @223.5.5.5
```

- 已解析到 101.132.20.134 → 跳到 Step 2。
- 未解析 → 检查本机有无 aliyun CLI（`command -v aliyun`，skyler.uno 大概率在阿里云）：有则 `aliyun alidns AddDomainRecord --DomainName skyler.uno --RR lele --Type A --Value 101.132.20.134`；没有则**停下来让用户去 DNS 控制台加 A 记录** `lele → 101.132.20.134`，确认解析后继续。

- [ ] **Step 2: 服务器侧勘察（只读）**

```bash
ssh root@101.132.20.134 "nginx -v 2>&1; ls /etc/nginx/conf.d/ /etc/nginx/sites-enabled/ 2>/dev/null; grep -rl 'lele-tools.skyler.uno' /etc/nginx/ 2>/dev/null"
```

确认：既有站点的 vhost 文件放哪个目录、lele-tools.skyler.uno 的配置长什么样（`cat` 出来作模板参考）、certbot 是否在用（`ls /etc/letsencrypt/live/`）。

- [ ] **Step 3: 建 webroot + vhost（仅新增）**

```bash
ssh root@101.132.20.134 "mkdir -p /var/www/lele && chown www-data:www-data /var/www/lele"
```

新建 vhost（路径按 Step 2 勘察结果，假设 conf.d）。先写 HTTP-only 版本（certbot 之后自动加 443）：

```nginx
# /etc/nginx/conf.d/lele.skyler.uno.conf
server {
    listen 80;
    server_name lele.skyler.uno;
    root /var/www/lele;
    index index.html;
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }
}
```

（`try_files` 带 `$uri.html` 是 VitePress cleanUrls 必需——对照服务器上 skylerx 站的既有配置，以它实际写法为准。）

```bash
ssh root@101.132.20.134 "nginx -t && nginx -s reload"
```

- [ ] **Step 4: SSL**

```bash
ssh root@101.132.20.134 "certbot --nginx -d lele.skyler.uno --non-interactive --agree-tos -m duhbbx@gmail.com"
ssh root@101.132.20.134 "nginx -t && nginx -s reload"
```

（certbot 不存在则按 Step 2 勘察看其它站怎么签的，照搬同款方式。）

- [ ] **Step 5: 验证**

```bash
curl --noproxy '*' -sI https://lele.skyler.uno | head -3   # 期望 200/403（还没部署内容，403/404 都正常）
```

本任务无代码提交；把勘察到的服务器要点（vhost 目录、certbot 方式）追加到 `docs/踩坑与要点.md` 并提交：`docs: server provisioning notes for lele.skyler.uno`。

---

### Task W8: 首次部署 + 收尾

- [ ] **Step 1: 配置 deploy target**

```bash
cp apps/website/.env.deploy.example apps/website/.env.deploy
# 填：HOST=101.132.20.134 USER=root WEBROOT=/var/www/lele DOMAIN=lele.skyler.uno
```

- [ ] **Step 2: 部署**

```bash
bash apps/website/deploy.sh
# 期望：build → rsync → chown/chmod → nginx reload OK → IndexNow 推送
```

- [ ] **Step 3: 线上验证**

```bash
curl --noproxy '*' -s https://lele.skyler.uno | grep -o '<title>[^<]*'   # 期望 乐乐的工具箱
curl --noproxy '*' -sI https://lele.skyler.uno/en/ | head -1             # 200
curl --noproxy '*' -s https://lele.skyler.uno/sitemap.xml | head -3      # sitemap 存在
```

手动浏览器过一遍 7 语切换、各页渲染。

- [ ] **Step 4: README 加官网链接 + 提交**

README.md 简介下加一行：`官网：https://lele.skyler.uno`。`docs/踩坑与要点.md` 补部署要点。

```bash
git add -A && git commit -m "docs: link website; deployment notes"
git push
```

---

## 完成标准

- `pnpm build:website` 绿：7 locale × 6 页全部产出，无死链报错。
- `https://lele.skyler.uno` HTTPS 可访问，中文首页 + 6 个翻译语言切换正常。
- 服务器上既有站点（lele-tools.skyler.uno / skylerx.skyler.uno / sole.skyler.uno）不受任何影响（部署前后 `curl -sI` 对照各回 200）。
- deploy.sh 可重复执行（迭代发布只需一条命令）。
