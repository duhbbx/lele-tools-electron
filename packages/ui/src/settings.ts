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
  const bridge = typeof window !== 'undefined' ? window.api?.store : undefined
  if (!bridge || hydrated) return
  hydrated = true
  try {
    const raw = await bridge.get(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>
      Object.assign(settings, {
        ...settings,
        ...parsed,
        aiProviders: { ...settings.aiProviders, ...(parsed.aiProviders ?? {}) },
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
