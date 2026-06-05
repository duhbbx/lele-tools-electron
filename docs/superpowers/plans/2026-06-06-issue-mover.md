# Issue Mover Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Issue 搬运" tool that lets users paste GitHub issue URLs, fetch their content via the `gh` CLI token, select issues + target repo, and bulk-create them in their own repo.

**Architecture:** Main-process Node code handles all GitHub API calls and token retrieval via `execFile('gh', ['auth','token'])`; the renderer communicates via IPC through a typed `GithubBridge`; a new `dev` category is introduced in the registry for this dev-collaboration tool.

**Tech Stack:** Electron IPC, Node `child_process.execFile` (promisified), Node native `fetch`, TypeScript, Vue 3 Composition API, Vitest.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `packages/shared-types/src/index.ts` | Modify | Add `GithubIssuePreview`, `GithubRepoInfo`, `GithubBridge` interfaces + wire `github` into `WindowApi` |
| `apps/desktop/src/main/github-url.ts` | Create | Pure URL parser — no IPC, no side effects; easy to unit-test |
| `apps/desktop/src/main/github-url.test.ts` | Create | 3 Vitest cases for parseIssueUrl |
| `apps/desktop/src/main/ipc/github.ts` | Create | `getToken()`, `fetchIssue()`, `listOwnRepos()`, `createIssue()`, `registerGithubIpc()` |
| `apps/desktop/src/main/index.ts` | Modify | Call `registerGithubIpc()` next to `registerAiIpc()` |
| `apps/desktop/src/preload/index.ts` | Modify | Add `github` bridge with 3 `ipcRenderer.invoke` wrappers |
| `packages/ui/src/registry.ts` | Modify | Add `'dev'` to `ToolCategory`, `CATEGORY_ORDER`, `CATEGORY_LABEL` |
| `packages/ui/src/tools/issue-mover/meta.ts` | Create | Tool metadata |
| `packages/ui/src/tools/issue-mover/Tool.vue` | Create | Full Vue component: URL input → fetch → select → create |
| `packages/ui/src/tools/index.ts` | Modify | Import and register `issue-mover` as 16th tool |

---

## Task 1: URL Parser — TDD

**Files:**
- Create: `apps/desktop/src/main/github-url.ts`
- Create: `apps/desktop/src/main/github-url.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/main/github-url.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseIssueUrl } from './github-url'

describe('parseIssueUrl', () => {
  it('parses a standard issue URL', () => {
    const r = parseIssueUrl('https://github.com/facebook/react/issues/123')
    expect(r).toEqual({ owner: 'facebook', repo: 'react', number: 123 })
  })

  it('parses URL with query string and fragment', () => {
    const r = parseIssueUrl(
      'https://github.com/vercel/next.js/issues/456?foo=bar#issuecomment-789',
    )
    expect(r).toEqual({ owner: 'vercel', repo: 'next.js', number: 456 })
  })

  it('returns null for invalid or non-issue URL', () => {
    expect(parseIssueUrl('https://github.com/foo/bar/pull/1')).toBeNull()
    expect(parseIssueUrl('not a url')).toBeNull()
    expect(parseIssueUrl('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/a9/Projects/lele-tools-electron && pnpm test -- --reporter=verbose apps/desktop/src/main/github-url.test.ts
```

Expected: FAIL — `parseIssueUrl` is not defined.

- [ ] **Step 3: Implement github-url.ts**

Create `apps/desktop/src/main/github-url.ts`:

```ts
export interface ParsedIssueUrl {
  owner: string
  repo: string
  number: number
}

/**
 * Parse a GitHub issue URL.
 * Accepts: https://github.com/{owner}/{repo}/issues/{number}[?...][#...]
 * Returns null if the URL doesn't match.
 */
export function parseIssueUrl(url: string): ParsedIssueUrl | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'github.com') return null
    // pathname: /{owner}/{repo}/issues/{number}
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/)
    if (!m) return null
    return { owner: m[1], repo: m[2], number: Number(m[3]) }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/a9/Projects/lele-tools-electron && pnpm test -- --reporter=verbose apps/desktop/src/main/github-url.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/a9/Projects/lele-tools-electron && git add apps/desktop/src/main/github-url.ts apps/desktop/src/main/github-url.test.ts && git commit -m "test: add parseIssueUrl with TDD (3 cases)"
```

---

## Task 2: Shared Types

**Files:**
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Append types and update WindowApi**

Append to `packages/shared-types/src/index.ts` (after the existing `MenuBridge` interface, before `WindowApi`):

```ts
export interface GithubIssuePreview {
  url: string
  owner: string
  repo: string
  number: number
  title: string
  /** markdown body (may be empty string) */
  body: string
  state: 'open' | 'closed'
  error?: string
}

export interface GithubRepoInfo {
  fullName: string
  private: boolean
}

export interface GithubBridge {
  /** Fetch a single issue (title + body); on failure returns preview with error field, never rejects */
  fetchIssue(url: string): Promise<GithubIssuePreview>
  /** List repos owned by the authenticated gh user, sorted by pushed */
  listOwnRepos(): Promise<GithubRepoInfo[]>
  /** Create an issue in fullName (owner/repo); returns the new issue html_url + number */
  createIssue(fullName: string, title: string, body: string): Promise<{ url: string; number: number }>
}
```

Then update `WindowApi`:

```ts
export interface WindowApi {
  ai: AiBridge
  store: StoreBridge
  recents: RecentsBridge
  chats: ChatsBridge
  menu: MenuBridge
  github: GithubBridge
}
```

- [ ] **Step 2: Typecheck shared-types**

```bash
cd /Users/a9/Projects/lele-tools-electron && pnpm --filter @lele/shared-types typecheck
```

Expected: No errors.

---

## Task 3: Main-Process GitHub IPC

**Files:**
- Create: `apps/desktop/src/main/ipc/github.ts`

- [ ] **Step 1: Create the IPC handler file**

Create `apps/desktop/src/main/ipc/github.ts`:

```ts
import { execFile as _execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'
import { parseIssueUrl } from '../github-url'

const execFile = promisify(_execFile)

const GH_HEADERS = {
  accept: 'application/vnd.github+json',
  'user-agent': 'lele-tools',
  'x-github-api-version': '2022-11-28',
}

/** Lazy, cached GitHub token from local gh CLI */
let _cachedToken: string | null = null

async function getToken(): Promise<string> {
  if (_cachedToken) return _cachedToken
  try {
    const { stdout } = await execFile('gh', ['auth', 'token'])
    const token = stdout.trim()
    if (!token) throw new Error('empty token')
    _cachedToken = token
    return token
  } catch {
    throw new Error('未检测到 gh CLI 登录（运行 gh auth login）')
  }
}

function authHeaders(token: string): Record<string, string> {
  return { ...GH_HEADERS, authorization: `Bearer ${token}` }
}

export function registerGithubIpc(): void {
  ipcMain.handle('github:fetch-issue', async (_e, url: string) => {
    const parsed = parseIssueUrl(url)
    if (!parsed) {
      return {
        url,
        owner: '',
        repo: '',
        number: 0,
        title: '',
        body: '',
        state: 'open' as const,
        error: '无法解析 Issue URL，格式：https://github.com/{owner}/{repo}/issues/{number}',
      }
    }
    try {
      const token = await getToken()
      const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}`
      const res = await fetch(apiUrl, { headers: authHeaders(token) })
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        let msg = `HTTP ${res.status}`
        try {
          const j = JSON.parse(errBody) as { message?: string }
          if (j.message) msg += `: ${j.message}`
        } catch { /* keep simple msg */ }
        return {
          url,
          owner: parsed.owner,
          repo: parsed.repo,
          number: parsed.number,
          title: '',
          body: '',
          state: 'open' as const,
          error: msg,
        }
      }
      const data = (await res.json()) as {
        title: string
        body: string | null
        state: string
        pull_request?: unknown
      }
      if (data.pull_request !== undefined) {
        return {
          url,
          owner: parsed.owner,
          repo: parsed.repo,
          number: parsed.number,
          title: data.title ?? '',
          body: '',
          state: 'open' as const,
          error: '这是 PR 不是 issue',
        }
      }
      return {
        url,
        owner: parsed.owner,
        repo: parsed.repo,
        number: parsed.number,
        title: data.title ?? '',
        body: data.body ?? '',
        state: (data.state === 'closed' ? 'closed' : 'open') as 'open' | 'closed',
      }
    } catch (e) {
      return {
        url,
        owner: parsed.owner,
        repo: parsed.repo,
        number: parsed.number,
        title: '',
        body: '',
        state: 'open' as const,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  })

  ipcMain.handle('github:list-repos', async () => {
    const token = await getToken()
    const res = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner',
      { headers: authHeaders(token) },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as Array<{ full_name: string; private: boolean }>
    return data.map((r) => ({ fullName: r.full_name, private: r.private }))
  })

  ipcMain.handle(
    'github:create-issue',
    async (_e, fullName: string, title: string, body: string) => {
      const token = await getToken()
      const res = await fetch(`https://api.github.com/repos/${fullName}/issues`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'content-type': 'application/json' },
        body: JSON.stringify({ title, body }),
      })
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        let msg = `HTTP ${res.status}`
        try {
          const j = JSON.parse(errBody) as { message?: string }
          if (j.message) msg += `: ${j.message}`
        } catch { /* keep simple msg */ }
        throw new Error(msg)
      }
      const data = (await res.json()) as { html_url: string; number: number }
      return { url: data.html_url, number: data.number }
    },
  )
}
```

- [ ] **Step 2: Wire into main/index.ts**

In `apps/desktop/src/main/index.ts`, add the import and call next to `registerAiIpc()`:

```ts
import { registerGithubIpc } from './ipc/github'
```

In `app.whenReady().then(...)`:

```ts
registerGithubIpc()
```

(Place it after `registerAiIpc()`)

- [ ] **Step 3: Typecheck desktop**

```bash
cd /Users/a9/Projects/lele-tools-electron && pnpm --filter @lele/desktop typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/a9/Projects/lele-tools-electron && git add packages/shared-types/src/index.ts apps/desktop/src/main/ipc/github.ts apps/desktop/src/main/index.ts && git commit -m "feat: github IPC handlers (fetch-issue, list-repos, create-issue)"
```

---

## Task 4: Preload Bridge

**Files:**
- Modify: `apps/desktop/src/preload/index.ts`

- [ ] **Step 1: Add github bridge**

In `apps/desktop/src/preload/index.ts`, add the `github` property to `api`:

```ts
github: {
  fetchIssue: (url: string) => ipcRenderer.invoke('github:fetch-issue', url),
  listOwnRepos: () => ipcRenderer.invoke('github:list-repos'),
  createIssue: (fullName: string, title: string, body: string) =>
    ipcRenderer.invoke('github:create-issue', fullName, title, body),
},
```

- [ ] **Step 2: Typecheck preload**

```bash
cd /Users/a9/Projects/lele-tools-electron && pnpm --filter @lele/desktop typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/a9/Projects/lele-tools-electron && git add apps/desktop/src/preload/index.ts && git commit -m "feat: expose github bridge via preload contextBridge"
```

---

## Task 5: Registry — Add 'dev' Category

**Files:**
- Modify: `packages/ui/src/registry.ts`

- [ ] **Step 1: Update registry.ts**

Replace the existing content of `packages/ui/src/registry.ts`:

```ts
import type { Component } from 'vue'
import type { Locale } from './i18n'

export type ToolCategory = 'format' | 'text' | 'generator' | 'dev' | 'time' | 'misc'

export const CATEGORY_ORDER: ToolCategory[] = ['format', 'text', 'generator', 'dev', 'time', 'misc']

export const CATEGORY_LABEL: Record<ToolCategory, Record<Locale, string>> = {
  format: { zh: '编码 & 格式化', en: 'Encode & Format' },
  text: { zh: '文本', en: 'Text' },
  generator: { zh: '生成器', en: 'Generators' },
  dev: { zh: '开发协作', en: 'Dev Collaboration' },
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

- [ ] **Step 2: Typecheck ui**

```bash
cd /Users/a9/Projects/lele-tools-electron && pnpm --filter @lele/ui typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/a9/Projects/lele-tools-electron && git add packages/ui/src/registry.ts && git commit -m "feat: add 'dev' category to tool registry"
```

---

## Task 6: Tool Meta

**Files:**
- Create: `packages/ui/src/tools/issue-mover/meta.ts`

- [ ] **Step 1: Create meta.ts**

Create `packages/ui/src/tools/issue-mover/meta.ts`:

```ts
import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'issue-mover',
  name: { zh: 'Issue 搬运', en: 'Issue Mover' },
  desc: {
    zh: '把其它开源项目的 issue 批量搬到自己的仓库',
    en: 'Move issues from other repos into your own',
  },
  category: 'dev',
  icon: '📦',
  keywords: ['github', 'issue', '迁移', '搬运', 'migrate'],
  load: () => import('./Tool.vue'),
}
```

---

## Task 7: Tool.vue Component

**Files:**
- Create: `packages/ui/src/tools/issue-mover/Tool.vue`

- [ ] **Step 1: Create Tool.vue**

Create `packages/ui/src/tools/issue-mover/Tool.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import type { GithubIssuePreview, GithubRepoInfo } from '@lele/shared-types'

// ---------- state ----------
const urlInput = ref('')
const busy = ref(false)
const fetchError = ref('')

interface PreviewEntry {
  preview: GithubIssuePreview
  checked: boolean
  result?: { url: string; number: number }
  createError?: string
}

const entries = ref<PreviewEntry[]>([])
const repos = ref<GithubRepoInfo[]>([])
const selectedRepo = ref('')
const reposError = ref('')
const summary = ref('')

// ---------- computed ----------
const checkedEntries = computed(() =>
  entries.value.filter((e) => e.checked && !e.preview.error),
)

const canMove = computed(
  () =>
    !busy.value &&
    selectedRepo.value !== '' &&
    checkedEntries.value.length > 0,
)

// ---------- methods ----------
async function loadRepos(): Promise<void> {
  reposError.value = ''
  try {
    repos.value = await window.api.github.listOwnRepos()
    if (repos.value.length > 0 && !selectedRepo.value) {
      selectedRepo.value = repos.value[0].fullName
    }
  } catch (e) {
    reposError.value = e instanceof Error ? e.message : String(e)
  }
}

async function fetchIssues(): Promise<void> {
  const lines = urlInput.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return
  busy.value = true
  fetchError.value = ''
  entries.value = []
  summary.value = ''
  try {
    for (const url of lines) {
      const preview = await window.api.github.fetchIssue(url)
      entries.value.push({ preview, checked: !preview.error })
    }
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function moveIssues(): Promise<void> {
  if (!canMove.value) return
  busy.value = true
  summary.value = ''
  let ok = 0
  let fail = 0
  for (const entry of checkedEntries.value) {
    entry.result = undefined
    entry.createError = undefined
  }
  for (const entry of checkedEntries.value) {
    const { preview } = entry
    const footer =
      `\n\n---\n> 搬运自: ${preview.url}`
    const body = preview.body ? preview.body + footer : footer.trimStart()
    try {
      const res = await window.api.github.createIssue(
        selectedRepo.value,
        preview.title,
        body,
      )
      entry.result = res
      ok++
    } catch (e) {
      entry.createError = e instanceof Error ? e.message : String(e)
      fail++
    }
  }
  summary.value = `完成：成功 ${ok} / 失败 ${fail}`
  busy.value = false
}

onMounted(loadRepos)
</script>

<template>
  <div class="tool-page">
    <!-- URL 输入区 -->
    <textarea
      v-model="urlInput"
      class="textarea"
      rows="5"
      :disabled="busy"
      placeholder="每行一个 GitHub Issue URL，例如：&#10;https://github.com/facebook/react/issues/123"
    />
    <div class="row">
      <button class="btn primary" :disabled="busy || !urlInput.trim()" @click="fetchIssues">
        {{ busy ? '抓取中…' : '抓取' }}
      </button>
      <span v-if="fetchError" class="error">{{ fetchError }}</span>
    </div>

    <!-- 抓取结果列表 -->
    <template v-if="entries.length">
      <div
        v-for="(entry, i) in entries"
        :key="i"
        class="row"
        style="align-items: flex-start; gap: 8px"
      >
        <input
          type="checkbox"
          :checked="entry.checked"
          :disabled="!!entry.preview.error || busy"
          style="margin-top: 3px; flex-shrink: 0"
          @change="entry.checked = ($event.target as HTMLInputElement).checked"
        />
        <div style="flex: 1; min-width: 0">
          <div v-if="entry.preview.error" class="error">
            {{ entry.preview.url }} — {{ entry.preview.error }}
          </div>
          <template v-else>
            <span style="font-weight: 500">{{ entry.preview.title }}</span>
            <span class="hint" style="margin-left: 8px">
              {{ entry.preview.owner }}/{{ entry.preview.repo }}#{{ entry.preview.number }}
            </span>
            <span v-if="entry.result" style="margin-left: 8px; color: var(--color-success, #22c55e)">
              ✅
              <a :href="entry.result.url" target="_blank" rel="noopener">#{{ entry.result.number }}</a>
            </span>
            <span v-else-if="entry.createError" class="error" style="margin-left: 8px">
              ❌ {{ entry.createError }}
            </span>
          </template>
        </div>
      </div>
    </template>

    <!-- 目标仓库行 -->
    <div class="row">
      <label style="flex-shrink: 0">目标仓库</label>
      <select v-model="selectedRepo" class="select" :disabled="busy || !repos.length" style="flex: 1; min-width: 0">
        <option v-if="!repos.length" value="">（加载中…）</option>
        <option
          v-for="r in repos"
          :key="r.fullName"
          :value="r.fullName"
        >
          {{ r.fullName }}{{ r.private ? ' 🔒' : '' }}
        </option>
      </select>
      <button class="btn" :disabled="busy" @click="loadRepos">刷新</button>
      <span v-if="reposError" class="error">{{ reposError }}</span>
    </div>

    <!-- 搬运按钮 -->
    <div class="row">
      <button class="btn primary" :disabled="!canMove" @click="moveIssues">
        搬运 {{ checkedEntries.length }} 条
      </button>
      <span v-if="summary" class="hint">{{ summary }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Typecheck ui**

```bash
cd /Users/a9/Projects/lele-tools-electron && pnpm --filter @lele/ui typecheck
```

Expected: No errors.

---

## Task 8: Register Tool in tools/index.ts

**Files:**
- Modify: `packages/ui/src/tools/index.ts`

- [ ] **Step 1: Add import and register**

Replace the content of `packages/ui/src/tools/index.ts`:

```ts
import type { ToolMeta } from '../registry'
import { meta as base64 } from './base64/meta'
import { meta as baseConvert } from './base-convert/meta'
import { meta as charCounter } from './char-counter/meta'
import { meta as colorTools } from './color-tools/meta'
import { meta as cronTool } from './cron/meta'
import { meta as dateTime } from './date-time/meta'
import { meta as httpStatus } from './http-status/meta'
import { meta as issueMover } from './issue-mover/meta'
import { meta as jsonFormatter } from './json-formatter/meta'
import { meta as passwordGen } from './password-gen/meta'
import { meta as qrCode } from './qr-code/meta'
import { meta as regexTest } from './regex-test/meta'
import { meta as textCrypto } from './text-crypto/meta'
import { meta as uuidGen } from './uuid-gen/meta'
import { meta as xmlFormatter } from './xml-formatter/meta'
import { meta as yamlFormatter } from './yaml-formatter/meta'

export const TOOLS: ToolMeta[] = [jsonFormatter, xmlFormatter, yamlFormatter, base64, baseConvert, charCounter, regexTest, textCrypto, passwordGen, uuidGen, qrCode, dateTime, cronTool, colorTools, httpStatus, issueMover]

export function toolById(id: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.id === id)
}
```

---

## Task 9: Final Verification & Commit

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/a9/Projects/lele-tools-electron && pnpm test
```

Expected: 33 tests pass (30 existing + 3 new github-url tests).

- [ ] **Step 2: Run typecheck across all packages**

```bash
cd /Users/a9/Projects/lele-tools-electron && pnpm typecheck
```

Expected: No errors.

- [ ] **Step 3: Run lint**

```bash
cd /Users/a9/Projects/lele-tools-electron && pnpm lint
```

Expected: No errors (or only warnings).

- [ ] **Step 4: Final commit**

```bash
cd /Users/a9/Projects/lele-tools-electron && git add packages/ui/src/tools/issue-mover/meta.ts packages/ui/src/tools/issue-mover/Tool.vue packages/ui/src/tools/index.ts && git commit -m "feat: issue mover tool with gh-cli credentials (new dev category)"
```

---

## Self-Review Checklist

### Spec Coverage

- [x] `GithubIssuePreview`, `GithubRepoInfo`, `GithubBridge` types defined — Task 2
- [x] `github: GithubBridge` added to `WindowApi` — Task 2
- [x] `getToken()` lazy+cached via `execFile('gh', ['auth','token'])` — Task 3
- [x] `parseIssueUrl` in own module with TDD test (3 cases) — Task 1
- [x] `fetchIssue` — non-OK returns error field not reject; PR guard — Task 3
- [x] `listOwnRepos` — affiliation=owner, sort=pushed — Task 3
- [x] `createIssue` — POST, non-OK throws — Task 3
- [x] `registerGithubIpc()` with all 3 handlers — Task 3
- [x] Wired into `apps/desktop/src/main/index.ts` — Task 3
- [x] Preload 3 invoke wrappers — Task 4
- [x] `'dev'` category in `ToolCategory`, `CATEGORY_ORDER`, `CATEGORY_LABEL` — Task 5
- [x] meta.ts with correct id/name/desc/category/icon/keywords — Task 6
- [x] Tool.vue: textarea URL input, fetch button, checkbox list, repo select + refresh, move button with count — Task 7
- [x] Body footer: `\n\n---\n> 搬运自: <url>` appended; empty body handled — Task 7
- [x] busy state prevents double-click during both fetch and move phases — Task 7
- [x] Per-row result: ✅ link or ❌ error; summary "成功 X / 失败 Y" — Task 7
- [x] `target="_blank"` links (handled by Electron's `setWindowOpenHandler`) — Task 7
- [x] Registered as 16th tool in tools/index.ts — Task 8
- [x] TDD evidence: write test → fail → implement → pass — Task 1
- [x] test count 33 (30 + 3) — Task 9
- [x] pnpm typecheck && pnpm test && pnpm lint green — Task 9
- [x] Commit message: `feat: issue mover tool with gh-cli credentials (new dev category)` — Task 9

### Type Consistency

- `GithubIssuePreview.state` is `'open' | 'closed'` in shared-types and returned with `as const` assertion in ipc handler ✓
- `GithubBridge.fetchIssue` returns `Promise<GithubIssuePreview>` — preload uses `ipcRenderer.invoke` which returns `Promise<any>` but typed by `WindowApi` ✓
- `GithubBridge.createIssue` returns `Promise<{ url: string; number: number }>` matching ipc handler's return ✓
- `parseIssueUrl` returns `ParsedIssueUrl | null` — used with null guard in ipc handler ✓
