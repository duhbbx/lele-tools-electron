<script setup lang="ts">
import { Marked, type Tokens } from 'marked'
import { computed } from 'vue'

const props = defineProps<{ content: string }>()

const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'ogg', 'flac']
const VIDEO_EXT = ['mp4', 'webm', 'mov']

// 独立 Marked 实例避免污染全局（AiChatPanel 用的是全局 marked）；
// image 渲染按扩展名升级为 <audio>/<video>
const md = new Marked({
  renderer: {
    image({ href, text }: Tokens.Image): string {
      const ext = (href.split('.').pop() ?? '').toLowerCase()
      if (AUDIO_EXT.includes(ext)) return `<audio controls src="${href}"></audio>`
      if (VIDEO_EXT.includes(ext)) return `<video controls src="${href}"></video>`
      return `<img src="${href}" alt="${text}">`
    },
  },
})

const html = computed(() => md.parse(props.content, { async: false }) as string)

function onClick(e: MouseEvent): void {
  const a = (e.target as HTMLElement).closest('a')
  if (!a) return
  e.preventDefault()
  const href = a.getAttribute('href') ?? ''
  if (href.startsWith('notes-file://')) {
    const id = Number(new URL(href).hostname)
    if (id) void window.api?.notes?.files?.open?.(id)
  } else if (/^https?:/.test(href)) {
    // 经主进程 setWindowOpenHandler 转交系统浏览器
    window.open(href)
  }
}
</script>

<template>
  <div class="note-preview" @click="onClick" v-html="html" />
</template>

<style scoped lang="scss">
.note-preview {
  overflow-y: auto;
  height: 100%;
  padding: 12px 18px;
  font-size: 14px;
  line-height: 1.7;

  :deep(h1) { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.25em; }
  :deep(h2) { font-size: 1.25em; }
  :deep(h1), :deep(h2), :deep(h3) { margin: 0.8em 0 0.4em; }
  :deep(p) { margin: 0.4em 0; }
  :deep(img), :deep(video) { max-width: 100%; border-radius: 6px; }
  :deep(audio) { width: 100%; }
  :deep(a) { color: var(--accent); }
  :deep(code) {
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 0.9em;
  }
  :deep(pre) {
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 12px;
    overflow-x: auto;
    code { background: none; border: none; padding: 0; }
  }
  :deep(blockquote) {
    margin: 0.6em 0;
    padding: 2px 12px;
    border-left: 3px solid var(--accent);
    color: var(--fg-dim);
  }
  :deep(table) { border-collapse: collapse; }
  :deep(th), :deep(td) { border: 1px solid var(--border); padding: 4px 10px; }
}
</style>
