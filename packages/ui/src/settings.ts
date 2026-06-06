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

/** 一个可命名的 AI 配置档（可同 provider 配多个，类似 db tools 的连接配置）。 */
export interface AiProfile extends AiProviderConfig {
  id: string
  name: string
  provider: AiProvider
}

function genAiId(): string {
  return `ai_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
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
  navCollapsed: boolean
  /** AI 配置档列表 + 当前激活档 id（可配多个，运行时按 activeAiId 选用） */
  aiProfiles: AiProfile[]
  activeAiId: string
}

/** 初始档：每个内置 provider 一份（id=provider），方便直接填 key 用 */
function defaultAiProfiles(): AiProfile[] {
  return AI_PROVIDER_ORDER.map((p) => ({
    id: p,
    name: AI_PROVIDER_LABEL[p],
    provider: p,
    ...structuredClone(AI_PROVIDER_DEFAULTS[p]),
  }))
}

function defaults(): Settings {
  return {
    locale: 'zh',
    theme: 'system',
    navWidth: 240,
    navCollapsed: false,
    aiProfiles: defaultAiProfiles(),
    activeAiId: 'deepseek',
  }
}

/** 兼容旧结构（aiProvider + aiProviders）→ 新的 aiProfiles + activeAiId */
function normalizeAi(saved: Record<string, unknown>): Pick<Settings, 'aiProfiles' | 'activeAiId'> {
  if (Array.isArray(saved.aiProfiles) && saved.aiProfiles.length) {
    const aiProfiles = saved.aiProfiles as AiProfile[]
    const activeAiId =
      typeof saved.activeAiId === 'string' &&
      aiProfiles.some((p) => p.id === saved.activeAiId)
        ? saved.activeAiId
        : aiProfiles[0].id
    return { aiProfiles, activeAiId }
  }
  // 旧库迁移：把每个 provider 的配置转成一份档
  const old = saved.aiProviders as Partial<Record<AiProvider, AiProviderConfig>> | undefined
  if (old) {
    const aiProfiles = AI_PROVIDER_ORDER.map((p) => ({
      id: p,
      name: AI_PROVIDER_LABEL[p],
      provider: p,
      ...AI_PROVIDER_DEFAULTS[p],
      ...(old[p] ?? {}),
    }))
    const activeAiId = typeof saved.aiProvider === 'string' ? saved.aiProvider : 'deepseek'
    return { aiProfiles, activeAiId }
  }
  return { aiProfiles: defaultAiProfiles(), activeAiId: 'deepseek' }
}

const KEY = 'lele.settings'

/** 同步读 localStorage：首屏 0ms 不闪默认值；SQLite 是真源，hydrate 后覆盖。 */
function load(): Settings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    if (!raw) return defaults()
    const saved = JSON.parse(raw) as Record<string, unknown>
    const base = defaults()
    return { ...base, ...(saved as Partial<Settings>), ...normalizeAi(saved) }
  } catch {
    return defaults()
  }
}

export const settings = reactive<Settings>(load())

/** 当前激活的 AI 配置档（找不到则退回第一份） */
export function activeAiProfile(): AiProfile | undefined {
  return settings.aiProfiles.find((p) => p.id === settings.activeAiId) ?? settings.aiProfiles[0]
}

/** 新增一份配置档（默认套用该 provider 的缺省值），返回新档 id 并设为激活 */
export function addAiProfile(provider: AiProvider = 'deepseek'): string {
  const id = genAiId()
  const n = settings.aiProfiles.filter((p) => p.provider === provider).length
  settings.aiProfiles.push({
    id,
    name: `${AI_PROVIDER_LABEL[provider]}${n ? ` ${n + 1}` : ''}`,
    provider,
    ...structuredClone(AI_PROVIDER_DEFAULTS[provider]),
  })
  settings.activeAiId = id
  return id
}

/** 删除一份配置档；删的是激活档时回退到第一份；至少保留一份 */
export function removeAiProfile(id: string): void {
  if (settings.aiProfiles.length <= 1) return
  const idx = settings.aiProfiles.findIndex((p) => p.id === id)
  if (idx === -1) return
  settings.aiProfiles.splice(idx, 1)
  if (settings.activeAiId === id) settings.activeAiId = settings.aiProfiles[0]?.id ?? ''
}

/** 当前激活档是否已配好（足以发请求）。本地 provider 只需 baseUrl。 */
export function isActiveAiConfigured(): boolean {
  const cfg = activeAiProfile()
  if (!cfg?.baseUrl?.trim()) return false
  return isLocalAiProvider(cfg.provider) ? true : !!cfg.apiKey?.trim()
}

let hydrated = false
/** 启动后从 SQLite 拉真源；SQLite 为空则把当前（localStorage/默认）推一份过去。 */
export async function hydrateSettings(): Promise<void> {
  const bridge = typeof window !== 'undefined' ? window.api?.store : undefined
  if (!bridge || hydrated) return
  hydrated = true
  try {
    const raw = await bridge.get(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      Object.assign(settings, {
        ...settings,
        ...(parsed as Partial<Settings>),
        ...normalizeAi(parsed),
      })
    }
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
    if (typeof window !== 'undefined') void window.api?.store?.set(KEY, json)
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
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = mode
}

/** 应用启动时调用一次：同步 locale + 主题 + 异步 hydrate。 */
export function initSettings(): void {
  locale.value = settings.locale
  applyTheme()
  void hydrateSettings()
}
