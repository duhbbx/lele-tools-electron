<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import '../monaco-setup'
import { resolvedTheme } from '../settings'

const props = defineProps<{ modelValue: string; language: string; readOnly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

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
  })
  editor.onDidChangeModelContent(() => {
    const v = editor?.getValue() ?? ''
    if (v !== props.modelValue) emit('update:modelValue', v)
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
