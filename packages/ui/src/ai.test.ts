import { afterEach, describe, expect, it } from 'vitest'
import { askAiChatStream } from './ai'
import { settings } from './settings'

describe('askAiChatStream', () => {
  // 模拟主进程 bridge：按给定 chunk 顺序回调 onChunk，再 resolve
  function mockBridge(chunks: string[]): void {
    ;(globalThis as unknown as { api: unknown }).api = {
      ai: {
        stream: async (
          _req: unknown,
          onChunk: (p: { chunk: string }) => void,
        ): Promise<{ ok: boolean; status: number }> => {
          for (const c of chunks) onChunk({ chunk: c })
          return { ok: true, status: 200 }
        },
      },
    }
  }
  afterEach(() => {
    delete (globalThis as unknown as { api?: unknown }).api
  })

  it('accumulates OpenAI-compat deltas across a frame split mid-chunk', async () => {
    settings.aiProvider = 'openai'
    settings.aiProviders.openai.baseUrl = 'https://api.openai.com'
    settings.aiProviders.openai.apiKey = 'sk-x'
    // 第 2、3 个 chunk 把一个 `\n\n` 帧边界劈成两半，考验跨 chunk 累积
    mockBridge([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
      '\ndata: {"choices":[{"delta":{"content":"!"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    const tokens: string[] = []
    const out = await askAiChatStream({ messages: [{ role: 'user', content: 'hi' }] }, (d) =>
      tokens.push(d),
    )
    expect(out).toBe('Hello!')
    expect(tokens).toEqual(['Hel', 'lo', '!'])
  })

  it('parses Anthropic content_block_delta events (ignores non-text events)', async () => {
    settings.aiProvider = 'anthropic'
    settings.aiProviders.anthropic.baseUrl = 'https://api.anthropic.com'
    settings.aiProviders.anthropic.apiKey = 'sk-ant'
    mockBridge([
      'event: message_start\ndata: {"type":"message_start"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"AB"}}\n\n',
      'data: {"type":"content_block_delta","delta":{"text":"CD"}}\n\n',
    ])
    const out = await askAiChatStream({ messages: [{ role: 'user', content: 'hi' }] }, () => {})
    expect(out).toBe('ABCD')
  })

  it('local provider (ollama) streams with no API key', async () => {
    settings.aiProvider = 'ollama'
    settings.aiProviders.ollama.baseUrl = 'http://localhost:11434'
    settings.aiProviders.ollama.apiKey = ''
    mockBridge(['data: {"choices":[{"delta":{"content":"hi"}}]}\n\n', 'data: [DONE]\n\n'])
    const out = await askAiChatStream({ messages: [{ role: 'user', content: 'x' }] }, () => {})
    expect(out).toBe('hi')
  })
})
