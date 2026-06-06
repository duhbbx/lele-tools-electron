<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import '../monaco-setup'
import { resolvedTheme } from '../settings'

const props = defineProps<{ modelValue: string; language: string; readOnly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [v: string]; scroll: [ratio: number] }>()

const host = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  editor = monaco.editor.create(host.value as HTMLElement, {
    value: props.modelValue,
    language: props.language,
    theme: resolvedTheme.value === 'dark' ? 'vs-dark' : 'vs',
    automaticLayout: true,
    minimap: { enabled: false },
    readOnly: props.readOnly ?? false,
    fontSize: 13,
    scrollBeyondLastLine: false,
    smoothScrolling: false,
    wordWrap: 'on',
    // 中文输入会大量触发全角字符的「歧义 Unicode」黄框误报，全局关闭
    unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
    // IME 合成期 Monaco 会把隐藏 textarea 显示出来；a11y 'auto' 时 textarea 装整个模型行，
    // wordWrap 下锚到首个折行行首且不折行铺开，把前文重复显示成重影。关掉后只写光标前单词。
    accessibilitySupport: 'off',
  })
  editor.onDidChangeModelContent(() => {
    const v = editor?.getValue() ?? ''
    if (v !== props.modelValue) emit('update:modelValue', v)
  })
  editor.onDidScrollChange(() => {
    if (!editor) return
    const max = editor.getScrollHeight() - editor.getLayoutInfo().height
    emit('scroll', max > 0 ? editor.getScrollTop() / max : 0)
  })
})

watch(
  () => props.modelValue,
  (v) => {
    if (editor && editor.getValue() !== v) editor.setValue(v)
  },
)
watch(
  () => props.language,
  (l) => {
    const m = editor?.getModel()
    if (m) monaco.editor.setModelLanguage(m, l)
  },
)
watch(resolvedTheme, (m) => monaco.editor.setTheme(m === 'dark' ? 'vs-dark' : 'vs'))

/** 在光标处插入文本（无光标则插到开头）；供工具层做「插入图片/文件」 */
function insertText(text: string): void {
  if (!editor) return
  const sel = editor.getSelection() ?? new monaco.Selection(1, 1, 1, 1)
  editor.executeEdits('insert', [{ range: sel, text, forceMoveMarkers: true }])
  editor.focus()
}

/** 按比例设置滚动位置（0~1），供双栏联动 */
function setScrollRatio(r: number): void {
  if (!editor) return
  const max = editor.getScrollHeight() - editor.getLayoutInfo().height
  editor.setScrollTop(Math.max(0, r * max))
}

defineExpose({ insertText, setScrollRatio })

onBeforeUnmount(() => editor?.dispose())
</script>

<template>
  <div ref="host" class="monaco-host" />
</template>

<style scoped>
.monaco-host {
  height: 100%;
  min-height: 120px;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
</style>
