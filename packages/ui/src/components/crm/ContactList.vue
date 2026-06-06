<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { CrmClient, CrmContactWithClient } from '@lele/shared-types'
import { t } from '../../i18n'
import { useConfirmDelete } from './confirm'

const props = defineProps<{ refreshTick: number }>()
const emit = defineEmits<{ open: [id: number, title: string]; add: []; deleted: [id: number] }>()

const q = ref('')
const clientId = ref(0)
const clients = ref<CrmClient[]>([])
const rows = ref<CrmContactWithClient[]>([])

async function load(): Promise<void> {
  try {
    rows.value =
      (await window.api?.crm?.contacts?.listAll?.({
        q: q.value.trim() || undefined,
        clientId: clientId.value || undefined,
      })) ?? []
  } catch (e) {
    console.warn('[ContactList] load error', e)
  }
}

async function loadClients(): Promise<void> {
  try {
    clients.value = (await window.api?.crm?.clients?.list?.()) ?? []
  } catch (e) {
    console.warn('[ContactList] load clients error', e)
  }
}

let debounce: ReturnType<typeof setTimeout> | null = null
watch(q, () => {
  if (debounce !== null) clearTimeout(debounce)
  debounce = setTimeout(() => void load(), 200)
})
watch(clientId, () => void load())
watch(() => props.refreshTick, () => {
  void load()
  void loadClients()
})
onMounted(() => {
  void load()
  void loadClients()
})

const { confirmingId, trigger } = useConfirmDelete(async (id) => {
  try {
    await window.api?.crm?.contacts?.remove?.(id)
    emit('deleted', id)
    await load()
  } catch (e) {
    console.warn('[ContactList] remove error', e)
  }
})
</script>

<template>
  <div class="crm-list">
    <div class="filter-bar">
      <input v-model="q" class="input search" :placeholder="t('crm.searchName')" />
      <select v-model.number="clientId" class="input">
        <option :value="0">{{ t('crm.all') }}</option>
        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <span class="spacer" />
      <button class="btn btn-primary" @click="emit('add')">＋ {{ t('crm.add') }}</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t('crm.name') }}</th>
            <th>{{ t('crm.client') }}</th>
            <th>{{ t('crm.role') }}</th>
            <th>{{ t('crm.phone') }}</th>
            <th>{{ t('crm.wechat') }}</th>
            <th>{{ t('crm.email') }}</th>
            <th>{{ t('crm.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ r.name }}</td>
            <td>{{ r.clientName }}</td>
            <td>{{ r.role }}</td>
            <td>{{ r.phone }}</td>
            <td>{{ r.wechat }}</td>
            <td class="ellipsis">{{ r.email }}</td>
            <td class="ops">
              <button class="link" @click="emit('open', r.id, r.name)">{{ t('crm.detail') }}</button>
              <button
                class="link danger"
                :class="{ confirming: confirmingId === r.id }"
                @click="trigger(r.id)"
              >{{ confirmingId === r.id ? t('crm.confirmDelete') : t('crm.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length" class="empty">{{ t('crm.empty') }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use './crm-list';
</style>
