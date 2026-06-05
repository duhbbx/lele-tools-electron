<script setup lang="ts">
import { computed, ref } from 'vue'
import { countText } from './count'

const text = ref('')
const stats = computed(() => countText(text.value))
const ITEMS = [
  ['chars', '字符数'],
  ['charsNoSpace', '字符数（不含空白）'],
  ['words', '单词数'],
  ['cjk', '中日韩字符'],
  ['lines', '行数'],
] as const
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <span v-for="[k, label] in ITEMS" :key="k" class="stat">
        <b>{{ stats[k] }}</b> <span class="hint">{{ label }}</span>
      </span>
    </div>
    <textarea v-model="text" class="textarea grow" rows="16" placeholder="粘贴文本…" />
  </div>
</template>

<style scoped>
.stat { margin-right: 16px; }
.stat b { font-size: 16px; }
</style>
