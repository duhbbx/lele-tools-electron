<script setup lang="ts">
import { computed, ref } from 'vue'
import { copyText } from '../../clipboard'
import { convertBase } from './convert'

const input = ref('255')
const fromBase = ref(10)
const BASES = [2, 8, 10, 16, 36]

const results = computed(() => {
  try {
    return { rows: BASES.map((b) => ({ base: b, value: convertBase(input.value, fromBase.value, b) })), error: '' }
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) }
  }
})
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <input v-model="input" class="input grow" placeholder="数值…" />
      <select v-model.number="fromBase" class="select">
        <option v-for="b in 35" :key="b" :value="b + 1">base {{ b + 1 }}</option>
      </select>
    </div>
    <p class="error">{{ results.error }}</p>
    <table v-if="results.rows.length" class="result">
      <tr v-for="r in results.rows" :key="r.base">
        <td class="hint">base {{ r.base }}</td>
        <td><code>{{ r.value }}</code></td>
        <td><button class="btn" @click="copyText(r.value)">⧉</button></td>
      </tr>
    </table>
  </div>
</template>

<style scoped>
.result td { padding: 4px 10px 4px 0; }
</style>
