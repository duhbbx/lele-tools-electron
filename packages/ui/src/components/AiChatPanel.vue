<script setup lang="ts">
import { marked } from 'marked'
import { nextTick, onMounted, ref } from 'vue'
import { askAiChatStream, type ChatMessage } from '../ai'
import { t } from '../i18n'
import { isActiveAiConfigured } from '../settings'

const props = defineProps<{ toolContext?: string }>()
const emit = defineEmits<{ close: [] }>()

const messages = ref<ChatMessage[]>([])
const input = ref('')
const busy = ref(false)
const error = ref('')
const listEl = ref<HTMLElement>()
let abort: AbortController | null = null

onMounted(async () => {
  const rows = (await window.api?.chats?.list?.()) ?? []
  messages.value = rows.map((r) => ({ role: r.role, content: r.content }))
  scrollDown()
})

function scrollDown(): void {
  void nextTick(() => listEl.value?.scrollTo({ top: listEl.value.scrollHeight }))
}

function render(md: string): string {
  return marked.parse(md, { async: false }) as string
}

async function send(): Promise<void> {
  const text = input.value.trim()
  if (!text || busy.value) return
  if (!isActiveAiConfigured()) {
    error.value = t('ai.notConfigured')
    return
  }
  error.value = ''
  input.value = ''
  messages.value.push({ role: 'user', content: text })
  void window.api?.chats?.append?.('user', text)
  messages.value.push({ role: 'assistant', content: '' })
  scrollDown()
  busy.value = true
  abort = new AbortController()
  const last = messages.value[messages.value.length - 1]
  try {
    const full = await askAiChatStream(
      {
        messages: messages.value.slice(0, -1),
        toolContext: props.toolContext,
        signal: abort.signal,
      },
      (delta) => {
        last.content += delta
        scrollDown()
      },
    )
    last.content = full || last.content
    void window.api?.chats?.append?.('assistant', last.content)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!last.content) messages.value.pop()
    if (msg !== 'AbortError' && !/abort/i.test(msg)) error.value = msg
  } finally {
    busy.value = false
    abort = null
  }
}

function stop(): void {
  abort?.abort()
}

async function clearAll(): Promise<void> {
  abort?.abort()
  messages.value = []
  await window.api?.chats?.clear?.()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void send()
  }
}
</script>

<template>
  <aside class="ai-panel">
    <div class="head">
      <span>{{ t('ai.title') }}</span>
      <span class="sp" />
      <button class="btn" @click="clearAll">{{ t('common.clear') }}</button>
      <button class="btn" @click="emit('close')">×</button>
    </div>
    <div ref="listEl" class="list">
      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <div v-if="m.role === 'assistant'" class="md" v-html="render(m.content)" />
        <div v-else class="raw">{{ m.content }}</div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
    <div class="foot">
      <textarea v-model="input" class="textarea" rows="3" :placeholder="t('ai.placeholder')" @keydown="onKey" />
      <button v-if="!busy" class="btn primary" @click="send">{{ t('ai.send') }}</button>
      <button v-else class="btn" @click="stop">{{ t('ai.stop') }}</button>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-left: 1px solid var(--border);
  background: var(--bg-soft);
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    .sp { flex: 1; }
  }
  .list { flex: 1; min-height: 0; overflow-y: auto; padding: 10px; }
  .msg {
    margin-bottom: 10px;
    &.user .raw {
      background: var(--accent);
      color: var(--accent-fg);
      border-radius: 10px 10px 2px 10px;
      padding: 6px 10px;
      margin-left: 40px;
      white-space: pre-wrap;
    }
    &.assistant .md {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px 10px 10px 2px;
      padding: 6px 10px;
      margin-right: 24px;
      overflow-x: auto;
      :deep(pre) { background: var(--bg-hover); padding: 8px; border-radius: 6px; overflow-x: auto; }
      :deep(p:first-child) { margin-top: 0; }
      :deep(p:last-child) { margin-bottom: 0; }
    }
  }
  .error { color: var(--danger); font-size: 12px; }
  .foot {
    display: flex;
    gap: 6px;
    align-items: flex-end;
    padding: 8px;
    border-top: 1px solid var(--border);
    .textarea { flex: 1; }
  }
}
</style>
