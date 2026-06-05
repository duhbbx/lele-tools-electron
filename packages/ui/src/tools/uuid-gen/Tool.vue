<script setup lang="ts">
import { ref } from 'vue'
import { copyText } from '../../clipboard'
import { t } from '../../i18n'

const count = ref(5)
const upper = ref(false)
const noDash = ref(false)
const out = ref<string[]>([])

function run(): void {
  out.value = Array.from({ length: Math.min(Math.max(count.value, 1), 100) }, () => {
    let u: string = crypto.randomUUID()
    if (noDash.value) u = u.replaceAll('-', '')
    return upper.value ? u.toUpperCase() : u
  })
}
run()
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <label>数量 <input v-model.number="count" class="input" type="number" min="1" max="100" style="width: 70px" /></label>
      <label><input v-model="upper" type="checkbox" /> 大写</label>
      <label><input v-model="noDash" type="checkbox" /> 去横线</label>
      <button class="btn primary" @click="run">生成</button>
      <button class="btn" @click="copyText(out.join('\n'))">{{ t('common.copy') }}</button>
    </div>
    <textarea :value="out.join('\n')" class="textarea grow" rows="10" readonly />
  </div>
</template>
