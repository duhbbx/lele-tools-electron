<script setup lang="ts">
import { ref } from 'vue'
import { testAiProvider } from '../ai'
import { LOCALE_LABEL, t } from '../i18n'
import { AI_PROVIDER_LABEL, AI_PROVIDER_ORDER, isLocalAiProvider, settings } from '../settings'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const testing = ref(false)
const testResult = ref('')

async function runTest(): Promise<void> {
  testing.value = true
  testResult.value = ''
  try {
    const r = await testAiProvider(settings.aiProvider, settings.aiProviders[settings.aiProvider])
    testResult.value = r.ok ? `OK: ${t('settings.ai.testOk')}` : (r.message ?? 'failed')
  } catch (e) {
    testResult.value = e instanceof Error ? e.message : String(e)
  } finally {
    testing.value = false
  }
}
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
      <h4>{{ t('settings.ai') }}</h4>
      <label class="field">
        <span>{{ t('settings.ai.provider') }}</span>
        <select v-model="settings.aiProvider" class="select">
          <option v-for="p in AI_PROVIDER_ORDER" :key="p" :value="p">{{ AI_PROVIDER_LABEL[p] }}</option>
        </select>
      </label>
      <label v-if="!isLocalAiProvider(settings.aiProvider)" class="field">
        <span>{{ t('settings.ai.apiKey') }}</span>
        <input v-model="settings.aiProviders[settings.aiProvider].apiKey" class="input" type="password" />
      </label>
      <label class="field">
        <span>{{ t('settings.ai.model') }}</span>
        <input v-model="settings.aiProviders[settings.aiProvider].model" class="input" />
      </label>
      <label class="field">
        <span>{{ t('settings.ai.baseUrl') }}</span>
        <input v-model="settings.aiProviders[settings.aiProvider].baseUrl" class="input" />
      </label>
      <div class="field">
        <span />
        <button class="btn" :disabled="testing" @click="runTest">
          {{ testing ? '…' : t('settings.ai.test') }}
        </button>
      </div>
      <p v-if="testResult" :class="testResult.startsWith('OK') ? 'hint' : 'error'" style="font-size: 12px">
        {{ testResult }}
      </p>
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
