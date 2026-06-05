<script setup lang="ts">
import { ref } from 'vue'
import { copyText } from '../../clipboard'
import { t } from '../../i18n'
import { decodeB64, encodeB64 } from './codec'

const input = ref('')
const output = ref('')
const error = ref('')

function run(fn: (s: string) => string): void {
  error.value = ''
  try {
    output.value = fn(input.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
const swap = () => { input.value = output.value; output.value = '' }
</script>

<template>
  <div class="tool-page">
    <textarea v-model="input" class="textarea grow" rows="8" placeholder="输入文本或 Base64…" />
    <div class="row">
      <button class="btn primary" @click="run(encodeB64)">编码 Encode</button>
      <button class="btn primary" @click="run(decodeB64)">解码 Decode</button>
      <button class="btn" @click="swap">↕ 交换</button>
      <button class="btn" @click="copyText(output)">{{ t('common.copy') }}</button>
      <span class="error">{{ error }}</span>
    </div>
    <textarea :value="output" class="textarea grow" rows="8" readonly />
  </div>
</template>
