<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '../../clipboard'
import { normalizeTs, tsToStrings } from './time'

const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onBeforeUnmount(() => clearInterval(timer))

const tsInput = ref('')
const tsResult = computed(() => {
  if (!tsInput.value.trim()) return null
  try {
    const r = tsToStrings(normalizeTs(tsInput.value))
    return { iso: r.iso, local: r.local, error: '' }
  } catch (e) {
    return { iso: '', local: '', error: e instanceof Error ? e.message : String(e) }
  }
})

const dateInput = ref('')
const dateResult = computed(() => {
  if (!dateInput.value.trim()) return null
  const d = new Date(dateInput.value)
  if (Number.isNaN(d.getTime())) return { s: '', ms: '', error: '无法解析的日期' }
  return { s: String(Math.floor(d.getTime() / 1000)), ms: String(d.getTime()), error: '' }
})
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <span class="hint">当前：</span><code>{{ Math.floor(now / 1000) }}</code>
      <span class="hint">(s)</span><code>{{ now }}</code><span class="hint">(ms)</span>
      <code>{{ new Date(now).toLocaleString() }}</code>
      <button class="btn" @click="copyText(String(Math.floor(now / 1000)))">⧉s</button>
    </div>
    <hr style="width: 100%; border-color: var(--border)" />
    <div class="row">
      <input v-model="tsInput" class="input grow" placeholder="时间戳（秒或毫秒）→ 日期" />
    </div>
    <p v-if="tsResult" :class="tsResult.error ? 'error' : ''">
      <template v-if="!tsResult.error">ISO: <code>{{ tsResult.iso }}</code>　本地: <code>{{ tsResult.local }}</code></template>
      <template v-else>{{ tsResult.error }}</template>
    </p>
    <div class="row">
      <input v-model="dateInput" class="input grow" placeholder="日期（如 2026-06-05 12:00:00）→ 时间戳" />
    </div>
    <p v-if="dateResult" :class="dateResult.error ? 'error' : ''">
      <template v-if="!dateResult.error">秒: <code>{{ dateResult.s }}</code>　毫秒: <code>{{ dateResult.ms }}</code></template>
      <template v-else>{{ dateResult.error }}</template>
    </p>
  </div>
</template>
