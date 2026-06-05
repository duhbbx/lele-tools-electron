import { locale } from './i18n'
import { type AiProvider, isLocalAiProvider, settings } from './settings'

/** 根据当前 UI 语言生成「请用对应语言回答」的提示，让 AI 回复跟着我们的 i18n 走。 */
function langPrompt(): string {
  return locale.value === 'zh'
    ? 'Always respond in 简体中文. Code blocks stay in their natural language.'
    : 'Always respond in English. Code blocks stay in their natural language.'
}

/**
 * 经主进程 IPC 做 fetch（绕过浏览器 CORS）。桌面端 preload 暴露 window.api.ai.fetch；
 * Web 端没有，fallback 到原生 fetch（Web 部署一般在自家域名下，由后端代理就够了）。
 */
interface AiBridge {
  fetch(req: {
    url: string
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    headers?: Record<string, string>
    body?: string
    timeoutMs?: number
    reqId?: string
  }): Promise<{ ok: boolean; status: number; body: string; error?: string }>
  cancel?(reqId: string): Promise<boolean>
  stream?(
    req: {
      url: string
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      headers?: Record<string, string>
      body?: string
      timeoutMs?: number
      reqId: string
    },
    onChunk: (payload: { chunk: string }) => void,
  ): Promise<{ ok: boolean; status: number; error?: string }>
}
function aiBridge(): AiBridge | null {
  const w = globalThis as { api?: { ai?: AiBridge } }
  return w.api?.ai ?? null
}

interface BridgeResponse {
  ok: boolean
  status: number
  body: string
}

/** 统一发请求：优先走 IPC（避 CORS）；否则原生 fetch。返回统一形如 Response 的对象（带 text() / json()）。 */
async function aiHttp(
  url: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
    signal?: AbortSignal
    timeoutMs?: number
  },
): Promise<BridgeResponse & { text(): Promise<string>; json(): Promise<unknown> }> {
  const bridge = aiBridge()
  if (bridge) {
    // 生成请求 id，并把渲染层的 AbortSignal 链到主进程的 ai:cancel
    const reqId = `r${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const onAbort = (): void => {
      void bridge.cancel?.(reqId)
    }
    if (init.signal) {
      if (init.signal.aborted) onAbort()
      else init.signal.addEventListener('abort', onAbort, { once: true })
    }
    try {
      const r = await bridge.fetch({
        url,
        method: init.method as 'POST',
        headers: init.headers,
        body: init.body,
        timeoutMs: init.timeoutMs,
        reqId,
      })
      if (r.error) {
        // 用户主动 abort vs 主进程超时分流：保留原始 error.name 语义
        const err = new Error(r.error) as Error & { aiAborted?: boolean }
        if (/abort/i.test(r.error)) err.aiAborted = true
        throw err
      }
      return {
        ok: r.ok,
        status: r.status,
        body: r.body,
        text: async () => r.body,
        json: async () => JSON.parse(r.body),
      }
    } finally {
      init.signal?.removeEventListener('abort', onAbort)
    }
  }
  const res = await fetch(url, init as RequestInit)
  const body = await res.text()
  return {
    ok: res.ok,
    status: res.status,
    body,
    text: async () => body,
    json: async () => JSON.parse(body),
  }
}

/**
 * 流式请求：逐帧把 SSE 的 `data:` JSON 交给 onData（provider 差异由调用方解析）。
 * 优先走 IPC bridge.stream（主进程推 raw chunk）；无 bridge 时退到原生 fetch + reader。
 * 内置一个跨 chunk 的 SSE 帧累积器：按空行(\n\n)切帧，取 data 行，遇 [DONE] 停。
 */
async function aiHttpStream(
  url: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
    signal?: AbortSignal
    timeoutMs?: number
  },
  onData: (json: unknown) => void,
): Promise<void> {
  let buf = ''
  let stopped = false
  const feed = (text: string): void => {
    if (stopped) return
    buf += text
    // SSE 帧之间用空行分隔；兼容 \r\n
    let idx = buf.search(/\r?\n\r?\n/)
    while (idx >= 0) {
      const frame = buf.slice(0, idx)
      buf = buf.slice(idx + (buf[idx] === '\r' ? 4 : 2))
      for (const rawLine of frame.split(/\r?\n/)) {
        const m = rawLine.match(/^data:\s?(.*)$/)
        if (!m) continue
        const payload = m[1]
        if (payload === '[DONE]') {
          stopped = true
          return
        }
        try {
          onData(JSON.parse(payload))
        } catch {
          /* 跳过非 JSON（注释行 / keep-alive） */
        }
      }
      idx = buf.search(/\r?\n\r?\n/)
    }
  }

  const bridge = aiBridge()
  if (bridge?.stream) {
    const reqId = `s${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const onAbort = (): void => {
      void bridge.cancel?.(reqId)
    }
    if (init.signal) {
      if (init.signal.aborted) onAbort()
      else init.signal.addEventListener('abort', onAbort, { once: true })
    }
    try {
      const r = await bridge.stream(
        {
          url,
          method: init.method as 'POST',
          headers: init.headers,
          body: init.body,
          timeoutMs: init.timeoutMs,
          reqId,
        },
        (p) => feed(p.chunk),
      )
      if (r.error) {
        const err = new Error(r.error) as Error & { aiAborted?: boolean }
        if (/abort/i.test(r.error)) err.aiAborted = true
        throw err
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
    } finally {
      init.signal?.removeEventListener('abort', onAbort)
    }
    return
  }

  // Web 兜底：原生 fetch 流式读取
  const res = await fetch(url, init as RequestInit)
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}`)
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    feed(dec.decode(value, { stream: true }))
    if (stopped) break
  }
}

async function throwIfNotOk(res: BridgeResponse & { json(): Promise<unknown> }): Promise<void> {
  if (res.ok) return
  let detail = ''
  try {
    const j = (await res.json()) as { error?: { message?: string } | string; message?: string }
    detail = typeof j.error === 'string' ? j.error : (j.error?.message ?? j.message ?? '')
  } catch {
    /* ignore */
  }
  throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`)
}

/**
 * 取请求用的 Bearer/key：本地 provider（Ollama）不强制 API Key，
 * 留空就用占位串（Ollama 的 OpenAI 兼容端点忽略它）；其余 provider 必须有 key。
 */
function resolveKey(provider: AiProvider, apiKey: string | undefined): string {
  const k = apiKey?.trim() || ''
  if (k) return k
  if (isLocalAiProvider(provider)) return 'local'
  throw new Error('NO_API_KEY')
}

// ── 多轮对话（chat panel 用）────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

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

export async function askAiChat(o: ChatOptions): Promise<string> {
  const provider = settings.aiProvider
  const cfg = settings.aiProviders[provider]
  const key = resolveKey(provider, cfg?.apiKey)
  const base = (cfg?.baseUrl || '').replace(/\/$/, '')
  if (!base) throw new Error('NO_BASE_URL')
  const model = cfg.model || 'default'
  const system = buildSystem(o)
  if (provider === 'anthropic') {
    const res = await aiHttp(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: 2000, system, messages: o.messages }),
      signal: o.signal,
    })
    await throwIfNotOk(res)
    const data = (await res.json()) as { content?: { type: string; text?: string }[] }
    return (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim()
  }
  // OpenAI 兼容
  const res = await aiHttp(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [{ role: 'system', content: system }, ...o.messages],
    }),
    signal: o.signal,
  })
  await throwIfNotOk(res)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return (data.choices?.[0]?.message?.content ?? '').trim()
}

/**
 * 流式版多轮对话：每来一段增量调用 onToken，返回累计的完整文本。
 * 失败（含 NO_BASE_URL / abort / HTTP 错）按非流式同样语义抛错，调用方可回退。
 */
export async function askAiChatStream(
  o: ChatOptions,
  onToken: (delta: string) => void,
): Promise<string> {
  const provider = settings.aiProvider
  const cfg = settings.aiProviders[provider]
  const key = resolveKey(provider, cfg?.apiKey)
  const base = (cfg?.baseUrl || '').replace(/\/$/, '')
  if (!base) throw new Error('NO_BASE_URL')
  const model = cfg.model || 'default'
  const system = buildSystem(o)
  let acc = ''
  const emit = (d: string): void => {
    if (d) {
      acc += d
      onToken(d)
    }
  }
  if (provider === 'anthropic') {
    await aiHttpStream(
      `${base}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model, max_tokens: 2000, system, messages: o.messages, stream: true }),
        signal: o.signal,
        timeoutMs: 120_000,
      },
      (j) => {
        // Anthropic SSE：content_block_delta 携带 delta.text
        const ev = j as { type?: string; delta?: { text?: string } }
        if (ev.type === 'content_block_delta' && ev.delta?.text) emit(ev.delta.text)
      },
    )
    return acc.trim()
  }
  await aiHttpStream(
    `${base}/v1/chat/completions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        stream: true,
        messages: [{ role: 'system', content: system }, ...o.messages],
      }),
      signal: o.signal,
      timeoutMs: 120_000,
    },
    (j) => {
      // OpenAI 兼容 SSE：choices[0].delta.content
      const ev = j as { choices?: { delta?: { content?: string } }[] }
      const d = ev.choices?.[0]?.delta?.content
      if (d) emit(d)
    },
  )
  return acc.trim()
}

export function currentProvider(): AiProvider {
  return settings.aiProvider
}

// ── Connectivity test ────────────────────────────────────────────────
// Settings → AI → 「测试连通」按钮触发. 用最轻量的请求确认 API Key 有效 +
// Base URL 可达 + 至少返回 200. 优先打 /v1/models (不烧 token, 只列模型);
// 若 404 / 501 (某些代理不暴露 /v1/models), fallback 到一次最小聊天请求.

export interface AiTestResult {
  ok: boolean
  /** 用户可见的简短消息(成功时含延迟 + 模型数; 失败时含 HTTP 状态/原因) */
  message: string
  latencyMs?: number
  modelCount?: number
}

/** Test a provider config — does NOT touch settings.aiProvider, runs against the supplied cfg. */
export async function testAiProvider(
  provider: AiProvider,
  cfg: { apiKey: string; baseUrl: string; model: string },
): Promise<AiTestResult> {
  // 本地 provider（Ollama）无需 Key，留空用占位串
  const key = cfg.apiKey?.trim() || (isLocalAiProvider(provider) ? 'local' : '')
  if (!key) return { ok: false, message: 'API Key 为空' }
  const base = (cfg.baseUrl || '').trim().replace(/\/$/, '')
  if (!base) return { ok: false, message: 'Base URL 为空' }

  const headers: Record<string, string> =
    provider === 'anthropic'
      ? {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        }
      : { authorization: `Bearer ${key}` }

  const t0 = Date.now()
  // Step 1: try /v1/models (lightweight, no token cost)
  try {
    const r = await aiHttp(`${base}/v1/models`, {
      method: 'GET',
      headers,
      body: '',
      timeoutMs: 15_000,
    })
    const latencyMs = Date.now() - t0
    if (r.ok) {
      let modelCount: number | undefined
      try {
        const data = JSON.parse(r.body) as { data?: Array<{ id?: string }> }
        modelCount = data.data?.length
      } catch {
        /* malformed JSON — still 200 means the auth worked */
      }
      return {
        ok: true,
        message:
          modelCount !== undefined
            ? `连通正常 (${latencyMs}ms · ${modelCount} 个模型可见)`
            : `连通正常 (${latencyMs}ms)`,
        latencyMs,
        modelCount,
      }
    }
    // 404 / 501 on /v1/models often means a proxy doesn't expose it — fall through to chat
    if (r.status !== 404 && r.status !== 501) {
      return {
        ok: false,
        message: `HTTP ${r.status}: ${(r.body || '').slice(0, 200) || '(empty body)'}`,
        latencyMs,
      }
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }

  // Step 2: minimal chat call as fallback (uses ≤ a handful of tokens)
  try {
    const model =
      cfg.model?.trim() || (provider === 'anthropic' ? 'claude-haiku-4-5' : 'gpt-4o-mini')
    const url = provider === 'anthropic' ? `${base}/v1/messages` : `${base}/v1/chat/completions`
    const body =
      provider === 'anthropic'
        ? JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          })
        : JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          })
    const r = await aiHttp(url, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body,
      timeoutMs: 20_000,
    })
    const latencyMs = Date.now() - t0
    if (r.ok) return { ok: true, message: `连通正常 (${latencyMs}ms · 模型 ${model})`, latencyMs }
    return {
      ok: false,
      message: `HTTP ${r.status}: ${(r.body || '').slice(0, 200) || '(empty body)'}`,
      latencyMs,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}
