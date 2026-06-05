<script setup lang="ts">
import { ref } from 'vue'
import { decryptText, encryptText } from './crypto'

const input = ref('')
const password = ref('')
const output = ref('')
const error = ref('')

async function run(fn: (s: string, p: string) => Promise<string>): Promise<void> {
  error.value = ''
  try {
    output.value = await fn(input.value, password.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="tool-page">
    <textarea v-model="input" class="textarea grow" rows="7" placeholder="明文或密文…" />
    <div class="row">
      <input v-model="password" class="input grow" type="password" placeholder="口令…" />
      <button class="btn primary" :disabled="!password" @click="run(encryptText)">加密</button>
      <button class="btn primary" :disabled="!password" @click="run(decryptText)">解密</button>
      <span class="error">{{ error }}</span>
    </div>
    <textarea :value="output" class="textarea grow" rows="7" readonly />
  </div>
</template>
