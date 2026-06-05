<script setup lang="ts">
import { LOCALE_LABEL, t } from '../i18n'
import { settings } from '../settings'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>{{ t('settings.title') }}</h3>
      <label class="field">
        <span>{{ t('settings.language') }}</span>
        <select v-model="settings.locale" class="select">
          <option value="zh">{{ LOCALE_LABEL.zh }}</option>
          <option value="en">{{ LOCALE_LABEL.en }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ t('settings.theme') }}</span>
        <select v-model="settings.theme" class="select">
          <option value="system">{{ t('settings.theme.system') }}</option>
          <option value="dark">{{ t('settings.theme.dark') }}</option>
          <option value="light">{{ t('settings.theme.light') }}</option>
        </select>
      </label>
      <!-- Task 10 在这里追加 AI provider 配置区 -->
      <div class="foot">
        <button class="btn" @click="emit('close')">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 45%);
  display: grid;
  place-items: center;
  z-index: 100;
}
.dialog {
  width: 460px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-soft);
  h3 { margin: 0 0 14px; }
  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    > span { color: var(--fg-dim); }
  }
  .foot { display: flex; justify-content: flex-end; margin-top: 14px; }
}
</style>
