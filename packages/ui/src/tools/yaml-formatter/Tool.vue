<script setup lang="ts">
import { parse, stringify } from 'yaml'
import { ref } from 'vue'
import MonacoEditor from '../../components/MonacoEditor.vue'

const text = ref('hello: lele\nitems:\n  - 1\n  - 2\n')
const lang = ref<'yaml' | 'json'>('yaml')
const error = ref('')

function guard(fn: () => void): void {
  error.value = ''
  try {
    fn()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
const fmt = () => guard(() => { text.value = stringify(parse(text.value)); lang.value = 'yaml' })
const toJson = () => guard(() => { text.value = JSON.stringify(parse(text.value), null, 2); lang.value = 'json' })
const toYaml = () => guard(() => { text.value = stringify(JSON.parse(text.value)); lang.value = 'yaml' })
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <button class="btn primary" @click="fmt">格式化 YAML</button>
      <button class="btn" @click="toJson">YAML → JSON</button>
      <button class="btn" @click="toYaml">JSON → YAML</button>
      <span class="error">{{ error }}</span>
    </div>
    <MonacoEditor v-model="text" :language="lang" class="grow" />
  </div>
</template>
