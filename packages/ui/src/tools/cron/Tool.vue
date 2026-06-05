<script setup lang="ts">
import { computed, ref } from 'vue'
import { nextRuns } from './cron'

const expr = ref('0 9 * * 1-5')
const result = computed(() => {
  try {
    return { runs: nextRuns(expr.value, 10), error: '' }
  } catch (e) {
    return { runs: [], error: e instanceof Error ? e.message : String(e) }
  }
})
const PRESETS: [string, string][] = [
  ['* * * * *', '每分钟'],
  ['0 * * * *', '每小时整点'],
  ['0 9 * * 1-5', '工作日 9 点'],
  ['0 0 1 * *', '每月 1 号零点'],
]
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <input v-model="expr" class="input grow" spellcheck="false" placeholder="分 时 日 月 周" />
    </div>
    <div class="row">
      <button v-for="[p, label] in PRESETS" :key="p" class="btn" @click="expr = p">{{ label }}</button>
    </div>
    <p class="error">{{ result.error }}</p>
    <table v-if="result.runs.length">
      <tr v-for="(d, i) in result.runs" :key="i">
        <td class="hint">#{{ i + 1 }}</td>
        <td><code>{{ d.toLocaleString() }}</code></td>
      </tr>
    </table>
  </div>
</template>
