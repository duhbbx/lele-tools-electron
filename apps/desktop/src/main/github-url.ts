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
