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
