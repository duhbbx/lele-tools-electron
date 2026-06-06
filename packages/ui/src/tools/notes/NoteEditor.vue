<script setup lang="ts">
import { ref } from 'vue'
import type { NoteFile } from '@lele/shared-types'
import MonacoEditor from '../../components/MonacoEditor.vue'

const props = defineProps<{ modelValue: string; noteId: number }>()
const emit = defineEmits<{ 'update:modelValue': [v: string]; scroll: [ratio: number] }>()

const editorRef = ref<InstanceType<typeof MonacoEditor>>()

function insertText(text: string): void {
  editorRef.value?.insertText(text)
}

/** 按附件 mime 生成 Markdown：图片/音频/视频用 ![]() 让预览渲染媒体，其他用普通链接 */
function insertFileMd(row: NoteFile): void {
  const url = `notes-file://${row.id}/${encodeURIComponent(row.name)}`
  const isMedia = /^(image|audio|video)\//.test(row.mime)
  insertText(isMedia ? `![${row.name}](${url})\n` : `[${row.name}](${url})\n`)
}

function setScrollRatio(r: number): void {
  editorRef.value?.setScrollRatio(r)
}

defineExpose({ insertText, insertFileMd, setScrollRatio })

/** 粘贴剪贴板里的文件/截图（capture 阶段先于 Monaco 处理） */
async function onPaste(e: ClipboardEvent): Promise<void> {
  const items = Array.from(e.clipboardData?.items ?? [])
  const fileItem = items.find((i) => i.kind === 'file')
  if (!fileItem) return // 纯文本粘贴交给 Monaco
  const f = fileItem.getAsFile()
  if (!f) return
  e.preventDefault()
  e.stopPropagation()
  const data = new Uint8Array(await f.arrayBuffer())
  // 截图粘贴的文件名通常是 image.png，换成时间戳避免同名堆积
  const name = !f.name || f.name === 'image.png' ? `paste-${Date.now()}.png` : f.name
  const row = await window.api?.notes?.files?.paste?.(props.noteId, name, f.type, data)
  if (row) insertFileMd(row)
}

/** 拖拽本地文件进编辑器 */
async function onDrop(e: DragEvent): Promise<void> {
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length === 0) return
  e.preventDefault()
  e.stopPropagation()
  for (const f of files) {
    const path = window.api?.notes?.fileToPath?.(f) ?? ''
    if (!path) continue
    const row = await window.api?.notes?.files?.importPath?.(props.noteId, path)
    if (row) insertFileMd(row)
  }
}
</script>

<template>
  <div class="note-editor" @paste.capture="onPaste" @drop.capture="onDrop" @dragover.prevent>
    <MonacoEditor
      ref="editorRef"
      :model-value="modelValue"
      language="markdown"
      @update:model-value="emit('update:modelValue', $event)"
      @scroll="emit('scroll', $event)"
    />
  </div>
</template>

<style scoped>
.note-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.note-editor :deep(.monaco-host) {
  flex: 1;
  border: none;
  border-radius: 0;
}
</style>
