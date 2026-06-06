<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { CrmClient, CrmProjectListItem } from '@lele/shared-types'
import { t } from '../../i18n'
import { centsToYuan } from '../../money'
import { useConfirmDelete } from './confirm'

const props = defineProps<{ refreshTick: number }>()
const emit = defineEmits<{ open: [id: number, title: string]; add: []; deleted: [id: number] }>()

const q = ref('')
const status = ref<'' | 'active' | 'done'>('')
const clientId = ref(0)
const clients = ref<CrmClient[]>([])
const rows = ref<CrmProjectListItem[]>([])

async function load(): Promise<void> {
  try {
    rows.value =
      (await window.api?.crm?.projects?.listAll?.({
        q: q.value.trim() || undefined,
        status: status.value || undefined,
        clientId: clientId.value || undefined,
      })) ?? []
  } catch (e) {
    console.warn('[ProjectList] load error', e)
  }
}

async function loadClients(): Promise<void> {
  try {
    clients.value = (await window.api?.crm?.clients?.list?.()) ?? []
  } catch (e) {
    console.warn('[ProjectList] load clients error', e)
  }
}

let debounce: ReturnType<typeof setTimeout> | null = null
watch(q, () => {
  if (debounce !== null) clearTimeout(debounce)
  debounce = setTimeout(() => void load(), 200)
})
watch([status, clientId], () => void load())
watch(() => props.refreshTick, () => {
  void load()
  void loadClients()
})
onMounted(() => {
  void load()
  void loadClients()
})

// 合计行：对当前筛选结果求和
const totalAmountCents = computed(() => rows.value.reduce((sum, r) => sum + r.amountCents, 0))
const totalShareCents = computed(() => rows.value.reduce((sum, r) => sum + r.shareCents, 0))

const { confirmingId, trigger } = useConfirmDelete(async (id) => {
  try {
    await window.api?.crm?.projects?.remove?.(id)
    emit('deleted', id)
    await load()
  } catch (e) {
    console.warn('[ProjectList] remove error', e)
  }
})
</script>

<template>
  <div class="crm-list">
    <div class="filter-bar">
      <input v-model="q" class="input search" :placeholder="t('crm.searchName')" />
      <select v-model="status" class="input">
        <option value="">{{ t('crm.all') }}</option>
        <option value="active">{{ t('crm.statusActive') }}</option>
        <option value="done">{{ t('crm.statusDone') }}</option>
      </select>
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
            <th>{{ t('crm.status') }}</th>
            <th>{{ t('crm.amount') }}</th>
            <th>{{ t('crm.shareAmount') }}</th>
            <th>{{ t('crm.endDate') }}</th>
            <th>{{ t('crm.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ r.name }}</td>
            <td>{{ r.clientName }}</td>
            <td>{{ r.status === 'active' ? t('crm.statusActive') : t('crm.statusDone') }}</td>
            <td>¥{{ centsToYuan(r.amountCents) }}</td>
            <td>¥{{ centsToYuan(r.shareCents) }}</td>
            <td>{{ r.endDate }}</td>
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
        <tfoot v-if="rows.length">
          <tr class="total-row">
            <td>{{ t('crm.total') }}</td>
            <td></td>
            <td></td>
            <td>¥{{ centsToYuan(totalAmountCents) }}</td>
            <td>¥{{ centsToYuan(totalShareCents) }}</td>
            <td></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div v-if="!rows.length" class="empty">{{ t('crm.empty') }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use './crm-list';
</style>
