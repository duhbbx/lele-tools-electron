<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import type { CrmClientSource, CrmContact, CrmProjectLite } from '@lele/shared-types'
import { t } from '../../i18n'
import { CLIENT_SOURCES, sourceLabel } from './options'

const props = defineProps<{ refId: number; refreshTick: number }>()
const emit = defineEmits<{
  rename: [title: string]
  removed: []
  openContact: [id: number, title: string]
  openProject: [id: number, title: string]
  addContact: []
  addProject: []
}>()

const form = reactive({
  name: '',
  type: 'company' as 'company' | 'person',
  note: '',
  phone: '',
  email: '',
  legalPerson: '',
  legalPersonPhone: '',
  uscc: '',
  regAddress: '',
  establishedDate: '',
  source: '' as CrmClientSource,
})
const dirty = ref(false)
const busy = ref(false)

const SECTIONS = [
  { key: 'basic', label: '基本信息' },
  { key: 'idcard', label: '证件' },
  { key: 'contacts', label: '干系人' },
  { key: 'projects', label: '项目' },
] as const
const activeSection = ref<(typeof SECTIONS)[number]['key']>('basic')

const contacts = ref<CrmContact[]>([])
const projects = ref<CrmProjectLite[]>([])

// ── 法人身份证正反面（路径单独维护，上传/删除即生效） ───────────────────────────
const idCard = reactive({ front: '', back: '' })
/** 同名路径覆盖上传后给 <img> 换 query 破缓存 */
const idCardVer = ref(0)

function idCardSrc(side: 'front' | 'back'): string {
  return `crm-file://idcard/${props.refId}/${side}?v=${idCardVer.value}`
}

async function pickIdCard(side: 'front' | 'back'): Promise<void> {
  try {
    const path = await window.api?.crm?.clients?.pickIdCard?.(props.refId, side)
    if (path != null) {
      idCard[side] = path
      idCardVer.value++
    }
  } catch (e) {
    console.warn('[ClientEditor] pickIdCard error', e)
  }
}

const idCardDeleteConfirm = ref<'front' | 'back' | null>(null)
let idCardDeleteTimer: ReturnType<typeof setTimeout> | null = null

async function removeIdCard(side: 'front' | 'back'): Promise<void> {
  if (idCardDeleteConfirm.value !== side) {
    if (idCardDeleteTimer !== null) clearTimeout(idCardDeleteTimer)
    idCardDeleteConfirm.value = side
    idCardDeleteTimer = setTimeout(() => {
      idCardDeleteConfirm.value = null
      idCardDeleteTimer = null
    }, 3000)
    return
  }
  if (idCardDeleteTimer !== null) {
    clearTimeout(idCardDeleteTimer)
    idCardDeleteTimer = null
  }
  idCardDeleteConfirm.value = null
  try {
    await window.api?.crm?.clients?.removeIdCard?.(props.refId, side)
    idCard[side] = ''
  } catch (e) {
    console.warn('[ClientEditor] removeIdCard error', e)
  }
}

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
    form.phone = client.phone
    form.email = client.email
    form.legalPerson = client.legalPerson
    form.legalPersonPhone = client.legalPersonPhone
    form.uscc = client.uscc
    form.regAddress = client.regAddress
    form.establishedDate = client.establishedDate
    form.source = client.source
    idCard.front = client.idCardFront
    idCard.back = client.idCardBack
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
      phone: form.phone,
      email: form.email,
      legalPerson: form.legalPerson,
      legalPersonPhone: form.legalPersonPhone,
      uscc: form.uscc,
      regAddress: form.regAddress,
      establishedDate: form.establishedDate,
      source: form.source,
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

    <div class="section-tabs">
      <button
        v-for="s in SECTIONS"
        :key="s.key"
        type="button"
        class="seg"
        :class="{ active: activeSection === s.key }"
        @click="activeSection = s.key"
      >{{ s.label }}</button>
    </div>

    <!-- Section 1: 基本信息 -->
    <div v-show="activeSection === 'basic'">
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
    <label class="field">
      <span>{{ t('crm.source') }}</span>
      <select v-model="form.source" class="input" @change="markDirty">
        <option value="">—</option>
        <option v-for="srcKey in CLIENT_SOURCES" :key="srcKey" :value="srcKey">{{ sourceLabel(srcKey) }}</option>
      </select>
    </label>
    <template v-if="form.type === 'person'">
      <label class="field">
        <span>{{ t('crm.mobile') }}</span>
        <input v-model="form.phone" class="input" type="text" @input="markDirty" />
      </label>
    </template>
    <template v-else>
      <label class="field">
        <span>{{ t('crm.legalPerson') }}</span>
        <input v-model="form.legalPerson" class="input" type="text" @input="markDirty" />
      </label>
      <label class="field">
        <span>{{ t('crm.legalPersonPhone') }}</span>
        <input v-model="form.legalPersonPhone" class="input" type="text" @input="markDirty" />
      </label>
      <label class="field">
        <span>{{ t('crm.uscc') }}</span>
        <input v-model="form.uscc" class="input" type="text" @input="markDirty" />
      </label>
      <label class="field">
        <span>{{ t('crm.regAddress') }}</span>
        <input v-model="form.regAddress" class="input" type="text" @input="markDirty" />
      </label>
      <label class="field">
        <span>{{ t('crm.establishedDate') }}</span>
        <input v-model="form.establishedDate" class="input" type="date" @input="markDirty" />
      </label>
    </template>
    <label class="field">
      <span>{{ t('crm.email') }}</span>
      <input v-model="form.email" class="input" type="email" @input="markDirty" />
    </label>
    <label class="field field-textarea">
      <span>{{ t('crm.note') }}</span>
      <textarea v-model="form.note" class="input" rows="3" @input="markDirty" />
    </label>
    </div>

    <!-- Section 2: 证件（法人身份证正反面，非必填） -->
    <div v-show="activeSection === 'idcard'" class="idcard-section">
      <div v-for="side in (['front', 'back'] as const)" :key="side" class="idcard-slot">
        <div class="idcard-label">{{ form.type === 'company' ? '法人' : '' }}身份证{{ side === 'front' ? '正面' : '反面' }}</div>
        <img v-if="idCard[side]" class="idcard-img" :src="idCardSrc(side)" alt="" />
        <div v-else class="idcard-empty">未上传</div>
        <div class="idcard-ops">
          <button type="button" class="btn btn-sm" @click="pickIdCard(side)">{{ idCard[side] ? '更换' : '上传' }}</button>
          <button
            v-if="idCard[side]"
            type="button"
            class="btn btn-sm btn-danger"
            :class="{ confirming: idCardDeleteConfirm === side }"
            @click="removeIdCard(side)"
          >{{ idCardDeleteConfirm === side ? '确认?' : '删除' }}</button>
        </div>
      </div>
    </div>

    <!-- Section 3: 干系人 -->
    <div v-show="activeSection === 'contacts'">
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
    </div>

    <!-- Section 4: 项目 -->
    <div v-show="activeSection === 'projects'">
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

  .section-tabs {
    display: flex;
    gap: 4px;
    margin: 10px 0 12px;
    border-bottom: 1px solid var(--border);

    .seg {
      border: 0;
      background: none;
      color: var(--fg-dim);
      padding: 6px 12px;
      cursor: pointer;
      font-size: 13px;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;

      &:hover { color: var(--fg); }

      &.active {
        color: var(--accent);
        border-bottom-color: var(--accent);
        font-weight: 600;
      }
    }
  }

  .idcard-section {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;

    .idcard-slot {
      flex: 1;
      min-width: 220px;
      max-width: 380px;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px;

      .idcard-label {
        font-size: 12px;
        color: var(--fg-dim);
        margin-bottom: 8px;
      }

      .idcard-img {
        width: 100%;
        border-radius: 4px;
        border: 1px solid var(--border);
        display: block;
      }

      .idcard-empty {
        display: grid;
        place-items: center;
        height: 120px;
        border: 1px dashed var(--border);
        border-radius: 4px;
        color: var(--fg-dim);
        font-size: 12px;
      }

      .idcard-ops {
        display: flex;
        gap: 6px;
        margin-top: 8px;
      }
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
      width: 8em;
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
