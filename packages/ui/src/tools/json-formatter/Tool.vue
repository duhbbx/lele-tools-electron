<script setup lang="ts">
import { ref } from 'vue'
import MonacoEditor from '../../components/MonacoEditor.vue'
import { t } from '../../i18n'

const text = ref('{\n  "hello": "lele"\n}')
const error = ref('')

function run(indent: number): void {
  error.value = ''
  try {
    text.value = JSON.stringify(JSON.parse(text.value), null, indent)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(text.value)
}
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <button class="btn primary" @click="run(2)">格式化 (2)</button>
      <button class="btn" @click="run(4)">格式化 (4)</button>
      <button class="btn" @click="run(0)">压缩</button>
      <button class="btn" @click="copy">{{ t('common.copy') }}</button>
      <span class="error">{{ error }}</span>
    </div>
    <MonacoEditor v-model="text" language="json" class="grow" />
  </div>
</template>
