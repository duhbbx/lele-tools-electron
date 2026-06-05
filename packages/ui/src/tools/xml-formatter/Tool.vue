<script setup lang="ts">
import { ref } from 'vue'
import MonacoEditor from '../../components/MonacoEditor.vue'
import { formatXml } from './xml-format'

const text = ref('<root><item id="1">hello</item></root>')
const error = ref('')

function run(): void {
  error.value = ''
  try {
    text.value = formatXml(text.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
function minify(): void {
  error.value = ''
  text.value = text.value.replace(/>\s+</g, '><').trim()
}
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <button class="btn primary" @click="run">格式化</button>
      <button class="btn" @click="minify">压缩</button>
      <span class="error">{{ error }}</span>
    </div>
    <MonacoEditor v-model="text" language="xml" class="grow" />
  </div>
</template>
