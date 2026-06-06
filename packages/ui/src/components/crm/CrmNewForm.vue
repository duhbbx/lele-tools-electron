<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { CrmClient } from '@lele/shared-types'
import { t } from '../../i18n'

const props = defineProps<{ entity: 'client' | 'contact' | 'project'; presetClientId?: number }>()
const emit = defineEmits<{ created: [id: number, title: string] }>()

const name = ref('')
const type = ref<'company' | 'person'>('company')
const clientId = ref<number>(props.presetClientId ?? 0)
const clients = ref<CrmClient[]>([])
const busy = ref(false)

const needClient = computed(() => props.entity !== 'client')
const canSave = computed(() => name.value.trim() !== '' && (!needClient.value || clientId.value > 0))

const HEADING: Record<typeof props.entity, string> = {
  client: '新建客户',
  contact: '新建干系人',
  project: '新建项目',
}

onMounted(async () => {
  if (!needClient.value) return
  try {
    clients.value = (await window.api?.crm?.clients?.list?.()) ?? []
  } catch (e) {
    console.warn('[CrmNewForm] load clients error', e)
  }
})

async function save(): Promise<void> {
  if (!canSave.value || busy.value) return
  busy.value = true
  try {
    const n = name.value.trim()
    let id: number | undefined
    if (props.entity === 'client') {
      id = await window.api?.crm?.clients?.create?.(n, type.value)
    } else if (props.entity === 'contact') {
      id = await window.api?.crm?.contacts?.create?.(clientId.value, n)
    } else {
      id = await window.api?.crm?.projects?.create?.(clientId.value, n)
    }
    if (id != null) emit('created', id, n)
  } catch (e) {
    console.warn('[CrmNewForm] create error', e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="tool-page crm-new-form">
    <h4 class="heading">{{ HEADING[entity] }}</h4>
    <label class="field">
      <span>{{ t('crm.name') }}</span>
      <input v-model="name" class="input" type="text" @keydown.enter="save" />
    </label>
    <label v-if="entity === 'client'" class="field">
      <span>{{ t('crm.type') }}</span>
      <select v-model="type" class="input">
        <option value="company">{{ t('crm.company') }}</option>
        <option value="person">{{ t('crm.person') }}</option>
      </select>
    </label>
    <label v-if="needClient" class="field">
      <span>{{ t('crm.client') }}</span>
      <select v-model.number="clientId" class="input">
        <option :value="0" disabled>—</option>
        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>
    <div class="actions">
      <button class="btn btn-primary" :disabled="!canSave || busy" @click="save">保存</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.crm-new-form {
  max-width: 480px;

  .heading {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 12px;

    > span {
      color: var(--fg-dim);
      width: 5em;
      flex-shrink: 0;
    }

    .input { flex: 1; min-width: 0; }
  }

  .actions { padding-left: calc(5em + 12px); }
}
</style>
