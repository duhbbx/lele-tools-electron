<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { CrmDoc } from '@lele/shared-types'
import { t } from '../../i18n'
import { useConfirmDelete } from './confirm'

const props = defineProps<{ refreshTick: number }>()

const q = ref('')
const rows = ref<CrmDoc[]>([])

async function load(): Promise<void> {
  try {
    rows.value = (await window.api?.crm?.docs?.list?.(q.value.trim() || undefined)) ?? []
  } catch (e) {
    console.warn('[DocList] load error', e)
  }
}

let debounce: ReturnType<typeof setTimeout> | null = null
watch(q, () => {
  if (debounce !== null) clearTimeout(debounce)
  debounce = setTimeout(() => void load(), 200)
})
watch(() => props.refreshTick, () => void load())
onMounted(() => void load())

async function upload(): Promise<void> {
  try {
    const picked = await window.api?.crm?.docs?.pick?.()
    if (picked?.length) await load()
  } catch (e) {
    console.warn('[DocList] upload error', e)
  }
}

async function open(id: number): Promise<void> {
  try {
    await window.api?.crm?.docs?.open?.(id)
  } catch (e) {
    console.warn('[DocList] open error', e)
  }
}

const { confirmingId, trigger } = useConfirmDelete(async (id) => {
  try {
    await window.api?.crm?.docs?.remove?.(id)
    await load()
  } catch (e) {
    console.warn('[DocList] remove error', e)
  }
})

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN')
}

function fmtSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`
}
</script>

<template>
  <div class="crm-list">
    <div class="filter-bar">
      <input v-model="q" class="input search" :placeholder="t('crm.searchName')" />
      <span class="spacer" />
      <button class="btn btn-primary" @click="upload">＋ {{ t('crm.upload') }}</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t('crm.name') }}</th>
            <th>{{ t('crm.size') }}</th>
            <th>{{ t('crm.uploadedAt') }}</th>
            <th>{{ t('crm.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" @dblclick="open(r.id)">
            <td class="ellipsis">{{ r.name }}</td>
            <td>{{ fmtSize(r.size) }}</td>
            <td>{{ fmtDate(r.uploadedAt) }}</td>
            <td class="ops">
              <button class="link" @click="open(r.id)">{{ t('crm.open') }}</button>
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
