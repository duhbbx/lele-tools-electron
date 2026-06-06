<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { testAiProvider } from '../ai'
import { LOCALE_LABEL, t } from '../i18n'
import {
  addAiProfile,
  AI_PROVIDER_DEFAULTS,
  AI_PROVIDER_LABEL,
  AI_PROVIDER_ORDER,
  type AiProvider,
  isLocalAiProvider,
  removeAiProfile,
  settings,
} from '../settings'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

type Section = 'general' | 'ai'
const section = ref<Section>('general')

// 正在编辑/选中的配置档 = 当前激活档
const editingId = computed({
  get: () => settings.activeAiId,
  set: (v: string) => {
    settings.activeAiId = v
  },
})
const editing = computed(() => settings.aiProfiles.find((p) => p.id === editingId.value))

const testing = ref(false)
const testResult = ref('')

watch(editingId, () => {
  testResult.value = ''
})

function onAdd(): void {
  addAiProfile('deepseek')
  testResult.value = ''
}

function onRemove(): void {
  if (!editing.value) return
  removeAiProfile(editing.value.id)
}

/** 切换 provider 时，若地址/模型还是空或仍是旧 provider 默认值，则套用新 provider 默认值 */
function onProviderChange(prov: AiProvider): void {
  const p = editing.value
  if (!p) return
  const def = AI_PROVIDER_DEFAULTS[prov]
  const wasDefaultBase = !p.baseUrl || AI_PROVIDER_ORDER.some((x) => AI_PROVIDER_DEFAULTS[x].baseUrl === p.baseUrl)
  const wasDefaultModel = !p.model || AI_PROVIDER_ORDER.some((x) => AI_PROVIDER_DEFAULTS[x].model === p.model)
  if (wasDefaultBase) p.baseUrl = def.baseUrl
  if (wasDefaultModel) p.model = def.model
}

async function runTest(): Promise<void> {
  if (!editing.value) return
  testing.value = true
  testResult.value = ''
  try {
    const r = await testAiProvider(editing.value.provider, editing.value)
    testResult.value = r.ok ? `OK: ${r.message}` : (r.message ?? 'failed')
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

      <div class="tabs">
        <button class="seg" :class="{ active: section === 'general' }" @click="section = 'general'">
          {{ t('settings.tab.general') }}
        </button>
        <button class="seg" :class="{ active: section === 'ai' }" @click="section = 'ai'">
          {{ t('settings.ai') }}
        </button>
      </div>

      <!-- 通用 -->
      <div v-show="section === 'general'" class="body">
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
      </div>

      <!-- AI 助手：多配置档 + 选择当前 -->
      <div v-show="section === 'ai'" class="body">
        <div class="profile-bar">
          <span class="bar-label">{{ t('settings.ai.profile') }}</span>
          <select v-model="editingId" class="select grow">
            <option v-for="p in settings.aiProfiles" :key="p.id" :value="p.id">
              {{ p.name === AI_PROVIDER_LABEL[p.provider] ? p.name : `${p.name} · ${AI_PROVIDER_LABEL[p.provider]}` }}
            </option>
          </select>
          <button class="btn" :title="t('settings.ai.addProfile')" @click="onAdd">＋</button>
          <button
            class="btn btn-danger"
            :disabled="settings.aiProfiles.length <= 1"
            :title="t('settings.ai.removeProfile')"
            @click="onRemove"
          >🗑</button>
        </div>
        <p class="active-hint">{{ t('settings.ai.activeHint') }}</p>

        <template v-if="editing">
          <label class="field">
            <span>{{ t('settings.ai.name') }}</span>
            <input v-model="editing.name" class="input" />
          </label>
          <label class="field">
            <span>{{ t('settings.ai.provider') }}</span>
            <select v-model="editing.provider" class="select" @change="onProviderChange(editing.provider)">
              <option v-for="p in AI_PROVIDER_ORDER" :key="p" :value="p">{{ AI_PROVIDER_LABEL[p] }}</option>
            </select>
          </label>
          <label v-if="!isLocalAiProvider(editing.provider)" class="field">
            <span>{{ t('settings.ai.apiKey') }}</span>
            <input v-model="editing.apiKey" class="input" type="password" />
          </label>
          <label class="field">
            <span>{{ t('settings.ai.model') }}</span>
            <input v-model="editing.model" class="input" />
          </label>
          <label class="field">
            <span>{{ t('settings.ai.baseUrl') }}</span>
            <input v-model="editing.baseUrl" class="input" />
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
        </template>
      </div>

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
  width: 480px;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-soft);
  h3 { margin: 0 0 12px; }

  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 14px;

    .seg {
      border: 0;
      background: none;
      color: var(--fg-dim);
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;

      &:hover { color: var(--fg); }
      &.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
    }
  }

  .body { overflow-y: auto; }

  .profile-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;

    .bar-label { color: var(--fg-dim); flex-shrink: 0; }
    .grow { flex: 1; min-width: 0; }
  }

  .active-hint {
    margin: 0 0 12px;
    font-size: 11px;
    color: var(--fg-dim);
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    > span { color: var(--fg-dim); width: 5em; flex-shrink: 0; }
    .input, .select { flex: 1; min-width: 0; }
  }

  .btn-danger {
    color: var(--danger, #e55);
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }

  .foot { display: flex; justify-content: flex-end; margin-top: 14px; }
}
</style>
