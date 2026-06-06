<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { CrmClient } from '@lele/shared-types'
import { t } from '../../i18n'
import { useConfirmDelete } from './confirm'
import { sourceLabel } from './options'

const props = defineProps<{ refreshTick: number }>()
const emit = defineEmits<{ open: [id: number, title: string]; add: []; deleted: [id: number] }>()

const q = ref('')
const type = ref<'' | 'company' | 'person'>('')
const rows = ref<CrmClient[]>([])

async function load(): Promise<void> {
  try {
    rows.value =
      (await window.api?.crm?.clients?.list?.({
        q: q.value.trim() || undefined,
        type: type.value || undefined,
      })) ?? []
  } catch (e) {
    console.warn('[ClientList] load error', e)
  }
}

let debounce: ReturnType<typeof setTimeout> | null = null
watch(q, () => {
  if (debounce !== null) clearTimeout(debounce)
  debounce = setTimeout(() => void load(), 200)
})
watch(type, () => void load())
watch(() => props.refreshTick, () => void load())
onMounted(() => void load())

const { confirmingId, trigger } = useConfirmDelete(async (id) => {
  try {
    await window.api?.crm?.clients?.remove?.(id)
    emit('deleted', id)
    await load()
  } catch (e) {
    console.warn('[ClientList] remove error', e)
  }
})

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="crm-list">
    <div class="filter-bar">
      <input v-model="q" class="input search" :placeholder="t('crm.searchName')" />
      <select v-model="type" class="input">
        <option value="">{{ t('crm.all') }}</option>
        <option value="company">{{ t('crm.company') }}</option>
        <option value="person">{{ t('crm.person') }}</option>
      </select>
      <span class="spacer" />
      <button class="btn btn-primary" @click="emit('add')">＋ {{ t('crm.add') }}</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t('crm.name') }}</th>
            <th>{{ t('crm.type') }}</th>
            <th>{{ t('crm.source') }}</th>
            <th>{{ t('crm.note') }}</th>
            <th>{{ t('crm.createdAt') }}</th>
            <th>{{ t('crm.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ r.name }}</td>
            <td>{{ r.type === 'company' ? t('crm.company') : t('crm.person') }}</td>
            <td>{{ sourceLabel(r.source) }}</td>
            <td class="ellipsis">{{ r.note }}</td>
            <td>{{ fmtDate(r.createdAt) }}</td>
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
