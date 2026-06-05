<script setup lang="ts">
import { computed, ref } from 'vue'
import { HTTP_STATUSES } from './data'

const q = ref('')
const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return HTTP_STATUSES
  return HTTP_STATUSES.filter(
    (x) => String(x.code).startsWith(s) || x.name.toLowerCase().includes(s) || x.zh.includes(s),
  )
})
function color(code: number): string {
  if (code < 200) return '#888'
  if (code < 300) return '#3a9e4f'
  if (code < 400) return '#c9a23c'
  if (code < 500) return '#d4763b'
  return '#cc4f44'
}
</script>

<template>
  <div class="tool-page">
    <input v-model="q" class="input" placeholder="搜索：404 / not found / 重定向…" />
    <div class="grow" style="overflow: auto">
      <table style="width: 100%">
        <tr v-for="x in list" :key="x.code">
          <td style="width: 60px"><b :style="{ color: color(x.code) }">{{ x.code }}</b></td>
          <td style="width: 220px"><code>{{ x.name }}</code></td>
          <td class="hint">{{ x.zh }}</td>
        </tr>
      </table>
    </div>
  </div>
</template>
