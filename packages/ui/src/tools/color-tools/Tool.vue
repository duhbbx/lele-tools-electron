<script setup lang="ts">
import { computed, ref } from 'vue'
import { copyText } from '../../clipboard'
import { hexToRgb, rgbToHex, rgbToHsl } from './color'

const hex = ref('#5b8def')
const parsed = computed(() => {
  try {
    const rgb = hexToRgb(hex.value)
    const hsl = rgbToHsl(rgb)
    return {
      hex: rgbToHex(rgb),
      rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
      error: '',
    }
  } catch (e) {
    return { hex: '', rgb: '', hsl: '', error: e instanceof Error ? e.message : String(e) }
  }
})
</script>

<template>
  <div class="tool-page">
    <div class="row">
      <input v-model="hex" class="input" style="width: 130px" spellcheck="false" />
      <input type="color" :value="parsed.hex || '#000000'" @input="hex = ($event.target as HTMLInputElement).value" />
      <span class="error">{{ parsed.error }}</span>
    </div>
    <div v-if="!parsed.error" class="swatch" :style="{ background: parsed.hex }" />
    <table v-if="!parsed.error">
      <tr v-for="[label, v] in [['HEX', parsed.hex], ['RGB', parsed.rgb], ['HSL', parsed.hsl]]" :key="label">
        <td class="hint">{{ label }}</td>
        <td><code>{{ v }}</code></td>
        <td><button class="btn" @click="copyText(v)">⧉</button></td>
      </tr>
    </table>
  </div>
</template>

<style scoped>
.swatch { width: 220px; height: 80px; border-radius: 8px; border: 1px solid var(--border); }
table td { padding: 4px 12px 4px 0; }
</style>
