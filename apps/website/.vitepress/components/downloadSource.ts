/**
 * 下载源 (GitHub Releases only).
 *
 * 策略:
 *  1. 用户在 localStorage 设过 'lele.dl.source' → 直接用 (手动覆盖最高优先级)
 *  2. 否则按浏览器时区猜:中国大陆 / 港澳几个时区 → 'oss'; 其余 → 'github'
 *     注意:Lele Tools 暂无 OSS 镜像,detectSource 实际始终返回 'github';
 *     保留接口不变以便日后扩展。
 *  3. SSR 阶段(VitePress build)没有 navigator → 默认 'github'
 *
 * 真正的下载链接由 DownloadMatrix 调用 fetchLatest(source) 获得;
 * 返回 { tag_name, assets: { name, url, size }[] } 给上层统一处理.
 * 若 GitHub Releases 尚无发布记录,返回空态(tag_name=null, assets=[]),
 * DownloadMatrix 将显示"暂无版本"。
 *
 * electron-builder 默认 artifactName 规则 (productName = "Lele Tools"):
 *   macOS:   "Lele Tools-{version}-arm64.dmg"
 *   Windows: "Lele Tools Setup {version}.exe"  (NSIS installer)
 *   Linux:   "lele-tools_{version}_amd64.deb" / "Lele Tools-{version}.AppImage"
 * 实际文件名以第一个 release 的真实产物为准,届时修订 DownloadMatrix 的 match 规则。
 */

const STORAGE_KEY = 'lele.dl.source'

export type DownloadSource = 'oss' | 'github'

/** 中国大陆 + 港澳台时区 (Taipei 也算,网络环境跟 mainland 相近, GitHub Releases CDN 也偶尔卡) */
const CN_TIMEZONES = new Set([
  'Asia/Shanghai',
  'Asia/Chongqing',
  'Asia/Chungking',
  'Asia/Urumqi',
  'Asia/Harbin',
  'Asia/Kashgar',
  'Asia/Hong_Kong',
  'Asia/Macau',
  'Asia/Macao',
  'Asia/Taipei',
])

export function detectSource(): DownloadSource {
  if (typeof window === 'undefined') return 'github' // SSR
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'oss' || saved === 'github') return saved
  } catch {
    /* localStorage 不可用 */
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (CN_TIMEZONES.has(tz)) return 'oss'
  } catch {
    /* Intl 不可用 */
  }
  return 'github'
}

export function saveSource(s: DownloadSource): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, s)
  } catch {
    /* localStorage 不可用 */
  }
}

// Lele Tools 暂无 OSS 镜像 — OSS_BASE/OSS_LATEST 保留接口但不可用
export const OSS_BASE = ''
export const OSS_LATEST = ''
export const GH_OWNER = 'duhbbx'
export const GH_REPO = 'lele-tools-electron'

export interface ReleaseAsset {
  name: string
  url: string
  size: number
}
export interface ReleaseInfo {
  tag_name: string | null
  assets: ReleaseAsset[]
  source: DownloadSource
}

/**
 * 从 OSS 拉 latest index.json — Lele Tools 暂无 OSS 镜像,直接抛错让调用方 fallback。
 */
export async function fetchFromOss(): Promise<ReleaseInfo> {
  throw new Error('OSS mirror not available for Lele Tools yet')
}

export async function fetchFromGithub(): Promise<ReleaseInfo> {
  // 用 /releases?per_page=1 包含 prerelease(等稳定版出来后可改 /releases/latest)
  const r = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases?per_page=1`,
  )
  if (!r.ok) throw new Error(`GitHub API ${r.status}`)
  const list = (await r.json()) as Array<{
    tag_name: string
    assets: { name: string; browser_download_url: string; size: number }[]
  }>
  const data = list[0]
  if (!data) {
    // 尚无任何 release — 返回空态,DownloadMatrix 显示"暂无版本"
    return { tag_name: null, assets: [], source: 'github' }
  }
  return {
    tag_name: data.tag_name,
    assets: (data.assets ?? []).map((a) => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size,
    })),
    source: 'github',
  }
}

/**
 * 按用户/区域选择的 source 取 release info.
 * Lele Tools 只有 GitHub 源;OSS 请求会直接 fallback 到 github。
 * 两源都失败时返回空态,UI 显示"暂无版本"。
 */
export async function fetchLatest(preferred: DownloadSource): Promise<ReleaseInfo> {
  const primary = preferred === 'oss' ? fetchFromOss : fetchFromGithub
  const fallback = preferred === 'oss' ? fetchFromGithub : fetchFromOss
  try {
    return await primary()
  } catch {
    try {
      return await fallback()
    } catch {
      // 两源都失败 → 返回空态，UI 显示"暂无版本"
      return { tag_name: null, assets: [], source: preferred }
    }
  }
}
