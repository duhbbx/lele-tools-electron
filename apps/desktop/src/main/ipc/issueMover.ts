import { ipcMain } from 'electron'
import type { ImRepo, ImRepoInput } from '@lele/shared-types'
import { type ImIssueUpsert, makeIssueMoverStore } from '../db/issueMoverStore'
import { getDb } from '../db/sqlite'
import { getToken } from './github'

let _store: ReturnType<typeof makeIssueMoverStore> | null = null
function s(): ReturnType<typeof makeIssueMoverStore> {
  if (_store === null) _store = makeIssueMoverStore(getDb())
  return _store
}

const GH_HEADERS = {
  accept: 'application/vnd.github+json',
  'user-agent': 'lele-tools',
  'x-github-api-version': '2022-11-28',
}

/** 该仓库自己的 token 优先；没填则退回 gh CLI token；都没有就匿名（公开库只读，有限速） */
async function tokenFor(repo: ImRepo): Promise<string> {
  if (repo.token.trim()) return repo.token.trim()
  try {
    return await getToken()
  } catch {
    return ''
  }
}

function headers(token: string, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...GH_HEADERS, ...extra }
  if (token) h.authorization = `Bearer ${token}`
  return h
}

/** 把 GitHub API 错误响应转成可读 message */
async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => '')
  let msg = `HTTP ${res.status}`
  try {
    const j = JSON.parse(body) as { message?: string }
    if (j.message) msg += `: ${j.message}`
  } catch {
    /* keep simple */
  }
  return msg
}

interface GhIssue {
  number: number
  title: string
  body: string | null
  state: string
  html_url: string
  created_at: string
  pull_request?: unknown
}

/** 单次请求超时（ms）：GitHub API 偶发慢/不可达时不让 fetch 无限挂起 */
const REQ_TIMEOUT_MS = 25_000

/**
 * 分页拉取一个仓库的 issue（排除 PR）；最多 50 页兜底。
 * sinceMs>0 时只拉「该时间后有更新」的（增量），靠 GitHub API 的 since 参数（按 updated_at）。
 */
async function fetchAllIssues(repo: ImRepo, token: string, sinceMs: number): Promise<ImIssueUpsert[]> {
  const out: ImIssueUpsert[] = []
  const sinceParam = sinceMs > 0 ? `&since=${encodeURIComponent(new Date(sinceMs).toISOString())}` : ''
  for (let page = 1; page <= 50; page++) {
    const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/issues?state=all&sort=updated&direction=asc&per_page=100&page=${page}${sinceParam}`
    const res = await fetch(url, { headers: headers(token), signal: AbortSignal.timeout(REQ_TIMEOUT_MS) })
    if (!res.ok) throw new Error(await readError(res))
    const data = (await res.json()) as GhIssue[]
    if (!Array.isArray(data) || data.length === 0) break
    for (const it of data) {
      if (it.pull_request !== undefined) continue // 排除 PR
      out.push({
        number: it.number,
        title: it.title ?? '',
        body: it.body ?? '',
        state: it.state === 'closed' ? 'closed' : 'open',
        htmlUrl: it.html_url ?? '',
        remoteCreatedAt: it.created_at ? Date.parse(it.created_at) || 0 : 0,
      })
    }
    if (data.length < 100) break
  }
  return out
}

export function registerIssueMoverIpc(): void {
  // ── 实例 ───────────────────────────────────────────────
  ipcMain.handle('issueMover:instances:list', () => s().instances.list())
  ipcMain.handle('issueMover:instances:get', (_e, id: number) => s().instances.get(id))
  ipcMain.handle('issueMover:instances:create', (_e, name: string) => s().instances.create(name))
  ipcMain.handle('issueMover:instances:rename', (_e, id: number, name: string) =>
    s().instances.rename(id, name),
  )
  ipcMain.handle('issueMover:instances:remove', (_e, id: number) => s().instances.remove(id))

  // ── 仓库 ───────────────────────────────────────────────
  ipcMain.handle('issueMover:repos:listByInstance', (_e, instanceId: number) =>
    s().repos.listByInstance(instanceId),
  )
  ipcMain.handle('issueMover:repos:add', (_e, instanceId: number, r: ImRepoInput) =>
    s().repos.add(instanceId, r),
  )
  ipcMain.handle(
    'issueMover:repos:update',
    (_e, id: number, r: { owner: string; name: string; token: string }) => s().repos.update(id, r),
  )
  ipcMain.handle('issueMover:repos:remove', (_e, id: number) => s().repos.remove(id))

  // 拉取该仓库远端 issue → 落库；默认增量（since=上次拉取时间），full=true 强制全量
  ipcMain.handle('issueMover:repos:pull', async (_e, id: number, full?: boolean) => {
    const repo = s().repos.get(id)
    if (!repo) return { ok: false, error: '仓库不存在' }
    if (!repo.owner.trim() || !repo.name.trim()) return { ok: false, error: '先填 owner/repo' }
    try {
      const token = await tokenFor(repo)
      const since = full ? 0 : repo.lastPulledAt
      // 拉取起点时间先记下，成功后再写库；避免漏掉「拉取过程中被更新」的 issue
      const startedAt = Date.now()
      const issues = await fetchAllIssues(repo, token, since)
      const count = s().issues.upsertMany(repo, issues)
      s().repos.setLastPulled(repo.id, startedAt)
      s().instances.touch(repo.instanceId)
      return { ok: true, count, incremental: since > 0 }
    } catch (e) {
      let msg = e instanceof Error ? e.message : String(e)
      if (e instanceof Error && (e.name === 'TimeoutError' || /aborted|timeout/i.test(msg))) {
        msg = `请求超时（${REQ_TIMEOUT_MS / 1000}s）——GitHub API 可能较慢或被网络拦截，建议挂代理或填 token 后重试`
      }
      return { ok: false, error: msg }
    }
  })

  // ── issue ──────────────────────────────────────────────
  ipcMain.handle('issueMover:issues:listByRepo', (_e, repoId: number) =>
    s().issues.listByRepo(repoId),
  )
  ipcMain.handle(
    'issueMover:issues:listByInstance',
    (_e, instanceId: number, kind: 'source' | 'target') =>
      s().issues.listByInstance(instanceId, kind),
  )

  ipcMain.handle('issueMover:issues:setExplain', (_e, id: number, text: string) =>
    s().issues.setAiExplain(id, text),
  )

  // 把一条源 issue 在目标仓库真建 issue，回写映射 + 标记已搬运
  ipcMain.handle('issueMover:issues:migrate', async (_e, sourceIssueId: number) => {
    const source = s().issues.get(sourceIssueId)
    if (!source) return { ok: false, error: '源 issue 不存在' }
    const target = s().repos.getTarget(source.instanceId)
    if (!target) return { ok: false, error: '请先配置目标仓库' }
    if (!target.owner.trim() || !target.name.trim()) return { ok: false, error: '目标仓库未填 owner/repo' }
    const token = (target.token.trim() || (await getToken().catch(() => ''))).trim()
    if (!token) return { ok: false, error: '目标仓库需要有写权限的 token' }
    try {
      const footer = `\n\n---\n> 搬运自: ${source.htmlUrl}`
      const body = source.body ? source.body + footer : footer.trimStart()
      const res = await fetch(`https://api.github.com/repos/${target.owner}/${target.name}/issues`, {
        method: 'POST',
        headers: headers(token, { 'content-type': 'application/json' }),
        body: JSON.stringify({ title: source.title, body }),
        signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      })
      if (!res.ok) return { ok: false, error: await readError(res) }
      const data = (await res.json()) as { html_url: string; number: number; created_at?: string }
      s().issues.insertTarget(target, {
        number: data.number,
        title: source.title,
        body,
        state: 'open',
        htmlUrl: data.html_url,
        remoteCreatedAt: data.created_at ? Date.parse(data.created_at) || 0 : 0,
        sourceIssueId: source.id,
      })
      s().issues.markMigrated(source.id, true)
      s().instances.touch(source.instanceId)
      return { ok: true, url: data.html_url, number: data.number }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
}
