<script setup lang="ts">
import { computed, ref } from 'vue'

const pattern = ref('\\d+')
const flags = ref('g')
const text = ref('order 42, qty 7')

const result = computed(() => {
  try {
    const re = new RegExp(pattern.value, flags.value)
    const matches: { m: string; index: number; groups: string[] }[] = []
    if (flags.value.includes('g')) {
      for (const mm of text.value.matchAll(re)) {
        matches.push({ m: mm[0], index: mm.index ?? 0, groups: mm.slice(1) })
        if (matches.length > 500) break
      }
    } else {
      const mm = re.exec(text.value)
      if (mm) matches.push({ m: mm[0], index: mm.index, groups: mm.slice(1) })
    }
    return { matches, error: '' }
  } catch (e) {
    return { matches: [], error: e instanceof Error ? e.message : String(e) }
  }
})
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <span>/</span>
      <input v-model="pattern" class="input grow" spellcheck="false" />
      <span>/</span>
      <input v-model="flags" class="input" style="width: 70px" placeholder="gimsuy" />
      <span class="hint">{{ result.matches.length }} 个匹配</span>
    </div>
    <p class="error">{{ result.error }}</p>
    <textarea v-model="text" class="textarea grow" rows="8" placeholder="被测文本…" />
    <div class="grow" style="overflow: auto">
      <table>
        <tr v-for="(m, i) in result.matches" :key="i">
          <td class="hint">@{{ m.index }}</td>
          <td><code>{{ m.m }}</code></td>
          <td class="hint">{{ m.groups.length ? `groups: ${m.groups.join(' | ')}` : '' }}</td>
        </tr>
      </table>
    </div>
  </div>
</template>
