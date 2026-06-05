<script setup lang="ts">
import { reactive, ref } from 'vue'
import { copyText } from '../../clipboard'
import { t } from '../../i18n'
import { generatePassword } from './gen'

const opts = reactive({ length: 16, lower: true, upper: true, digits: true, symbols: true })
const out = ref<string[]>([])
const error = ref('')

function run(): void {
  error.value = ''
  try {
    out.value = Array.from({ length: 5 }, () => generatePassword(opts))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
run()
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <label>长度 <input v-model.number="opts.length" class="input" type="number" min="4" max="128" style="width: 70px" /></label>
      <label><input v-model="opts.lower" type="checkbox" /> a-z</label>
      <label><input v-model="opts.upper" type="checkbox" /> A-Z</label>
      <label><input v-model="opts.digits" type="checkbox" /> 0-9</label>
      <label><input v-model="opts.symbols" type="checkbox" /> !@#</label>
      <button class="btn primary" @click="run">生成</button>
      <span class="error">{{ error }}</span>
    </div>
    <div v-for="(p, i) in out" :key="i" class="row">
      <code class="grow">{{ p }}</code>
      <button class="btn" @click="copyText(p)">{{ t('common.copy') }}</button>
    </div>
  </div>
</template>
