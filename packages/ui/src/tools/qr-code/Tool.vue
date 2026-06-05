<script setup lang="ts">
import QRCode from 'qrcode'
import { ref, watchEffect } from 'vue'

const text = ref('https://github.com/duhbbx/lele-tools-electron')
const size = ref(280)
const ecc = ref<'L' | 'M' | 'Q' | 'H'>('M')
const canvas = ref<HTMLCanvasElement>()
const error = ref('')

watchEffect(() => {
  if (!canvas.value) return
  error.value = ''
  if (!text.value) return
  QRCode.toCanvas(canvas.value, text.value, {
    width: size.value,
    errorCorrectionLevel: ecc.value,
    margin: 2,
  }).catch((e: unknown) => {
    error.value = e instanceof Error ? e.message : String(e)
  })
})

function download(): void {
  const a = document.createElement('a')
  a.download = 'qrcode.png'
  a.href = canvas.value?.toDataURL('image/png') ?? ''
  a.click()
}
</script>

<template>
  <div class="tool-page">
    <textarea v-model="text" class="textarea" rows="4" placeholder="文本 / URL…" />
    <div class="row">
      <label>尺寸 <input v-model.number="size" class="input" type="number" min="120" max="1024" step="20" style="width: 80px" /></label>
      <label>纠错
        <select v-model="ecc" class="select">
          <option value="L">L 7%</option><option value="M">M 15%</option>
          <option value="Q">Q 25%</option><option value="H">H 30%</option>
        </select>
      </label>
      <button class="btn" @click="download">下载 PNG</button>
      <span class="error">{{ error }}</span>
    </div>
    <canvas ref="canvas" style="align-self: flex-start; background: #fff; border-radius: 8px" />
  </div>
</template>
