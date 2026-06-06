<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import type { CrmContact, CrmProjectLite } from '@lele/shared-types'
import { t } from '../../i18n'

const props = defineProps<{ refId: number; refreshTick: number }>()
const emit = defineEmits<{
  rename: [title: string]
  removed: []
  openContact: [id: number, title: string]
  openProject: [id: number, title: string]
  addContact: []
  addProject: []
}>()

const form = reactive({ name: '', type: 'company' as 'company' | 'person', note: '' })
const dirty = ref(false)
const busy = ref(false)

const contacts = ref<CrmContact[]>([])
const projects = ref<CrmProjectLite[]>([])

// ── delete confirm（同 ContactEditor 模式）──────────────────────────────────────
const deleteConfirming = ref(false)
let deleteTimer: ReturnType<typeof setTimeout> | null = null

function startDelete(): void {
  if (deleteConfirming.value) {
    void executeDelete()
    return
  }
  deleteConfirming.value = true
  deleteTimer = setTimeout(() => {
    deleteConfirming.value = false
    deleteTimer = null
  }, 3000)
}

async function executeDelete(): Promise<void> {
  if (deleteTimer !== null) {
    clearTimeout(deleteTimer)
    deleteTimer = null
  }
  deleteConfirming.value = false
  busy.value = true
  try {
    await window.api?.crm?.clients?.remove?.(props.refId)
    emit('removed')
  } catch (e) {
    console.warn('[ClientEditor] remove error', e)
  } finally {
    busy.value = false
  }
}

// ── load ───────────────────────────────────────────────────────────────────────
async function loadRelated(): Promise<void> {
  try {
    contacts.value = (await window.api?.crm?.contacts?.listByClient?.(props.refId)) ?? []
    projects.value = (await window.api?.crm?.projects?.listByClient?.(props.refId)) ?? []
  } catch (e) {
    console.warn('[ClientEditor] load related error', e)
  }
}

onMounted(async () => {
  try {
    const client = (await window.api?.crm?.clients?.get?.(props.refId)) ?? null
    if (!client) {
      emit('removed')
      return
    }
    form.name = client.name
    form.type = client.type
    form.note = client.note
    dirty.value = false
    await loadRelated()
  } catch (e) {
    console.warn('[ClientEditor] load error', e)
    emit('removed')
  }
})

watch(() => props.refreshTick, () => void loadRelated())

// ── save ───────────────────────────────────────────────────────────────────────
async function save(): Promise<void> {
  if (!dirty.value || busy.value) return
  busy.value = true
  try {
    await window.api?.crm?.clients?.update?.(props.refId, {
      name: form.name,
      type: form.type,
      note: form.note,
    })
    dirty.value = false
    emit('rename', form.name)
  } catch (e) {
    console.warn('[ClientEditor] save error', e)
  } finally {
    busy.value = false
  }
}

function markDirty(): void {
  dirty.value = true
}
</script>

<template>
  <div class="tool-page client-editor">
    <!-- Sticky top bar -->
    <div class="top-bar">
      <span class="client-heading">{{ form.name || '客户' }}</span>
      <button class="btn btn-primary" :disabled="!dirty || busy" @click="save">保存</button>
      <button
        class="btn btn-danger"
        :class="{ confirming: deleteConfirming }"
        :disabled="busy"
        @click="startDelete"
      >{{ deleteConfirming ? '确认删除?' : '删除客户' }}</button>
    </div>

    <!-- 基本信息 -->
    <label class="field">
      <span>{{ t('crm.name') }}</span>
      <input v-model="form.name" class="input" type="text" @input="markDirty" />
    </label>
    <label class="field">
      <span>{{ t('crm.type') }}</span>
      <select v-model="form.type" class="input" @change="markDirty">
        <option value="company">{{ t('crm.company') }}</option>
        <option value="person">{{ t('crm.person') }}</option>
      </select>
    </label>
    <label class="field field-textarea">
      <span>{{ t('crm.note') }}</span>
      <textarea v-model="form.note" class="input" rows="3" @input="markDirty" />
    </label>

    <!-- 关联：干系人 -->
    <div class="section-head">
      <h4 class="section-title">{{ t('crm.contacts') }}</h4>
      <button class="btn btn-sm" @click="emit('addContact')">＋ {{ t('crm.add') }}</button>
    </div>
    <table v-if="contacts.length" class="related-table">
      <tbody>
        <tr v-for="c in contacts" :key="c.id">
          <td>{{ c.name }}</td>
          <td class="dim">{{ c.role }}</td>
          <td class="dim">{{ c.phone }}</td>
          <td class="ops">
            <button class="link" @click="emit('openContact', c.id, c.name)">{{ t('crm.detail') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty-hint">{{ t('crm.empty') }}</p>

    <!-- 关联：项目 -->
    <div class="section-head">
      <h4 class="section-title">{{ t('crm.projects') }}</h4>
      <button class="btn btn-sm" @click="emit('addProject')">＋ {{ t('crm.add') }}</button>
    </div>
    <table v-if="projects.length" class="related-table">
      <tbody>
        <tr v-for="p in projects" :key="p.id">
          <td>{{ p.name }}</td>
          <td class="dim">{{ p.status === 'active' ? t('crm.statusActive') : t('crm.statusDone') }}</td>
          <td class="ops">
            <button class="link" @click="emit('openProject', p.id, p.name)">{{ t('crm.detail') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty-hint">{{ t('crm.empty') }}</p>
  </div>
</template>

<style scoped lang="scss">
.client-editor {
  .top-bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0 10px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    margin-bottom: 4px;

    .client-heading {
      flex: 1;
      font-size: 15px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;

    > span {
      color: var(--fg-dim);
      width: 3em;
      flex-shrink: 0;
    }

    .input { flex: 1; min-width: 0; }

    &.field-textarea {
      align-items: flex-start;

      > span { padding-top: 4px; }
    }
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;

    .section-title {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--fg-dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }

  .related-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    td {
      padding: 5px 6px;
      border-bottom: 1px solid var(--border);
    }

    .dim { color: var(--fg-dim); }

    .ops {
      text-align: right;
      white-space: nowrap;

      .link {
        border: 0;
        background: none;
        color: var(--accent);
        cursor: pointer;
        font-size: 13px;

        &:hover { text-decoration: underline; }
      }
    }
  }

  .empty-hint {
    font-size: 12px;
    color: var(--fg-dim);
    margin: 6px 0;
  }

  .btn-sm {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 3px;
    border: 1px solid var(--border);
    cursor: pointer;
    background: none;

    &:hover:not(:disabled) { background: var(--bg-hover); }
  }

  .btn-danger {
    border: 1px solid #e55;
    color: #e55;
    background: transparent;
    border-radius: 4px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.15s;

    &:hover:not(:disabled) { background: color-mix(in srgb, #e55 12%, transparent); }

    &.confirming {
      background: color-mix(in srgb, #e55 18%, transparent);
      font-weight: 600;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}
</style>
