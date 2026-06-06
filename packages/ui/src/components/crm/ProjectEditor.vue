<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { CrmFile, CrmPayment, CrmProject } from '@lele/shared-types'
import { centsToYuan, yuanToCents } from '../../money'
import SecretInput from './SecretInput.vue'

const props = defineProps<{ refId: number }>()
const emit = defineEmits<{ rename: [title: string]; removed: [] }>()

// ── form state (sections 1-3) ──────────────────────────────────────────────────
const form = reactive({
  name: '',
  status: 'active' as 'active' | 'done',
  description: '',
  amountYuan: '0.00',
  endDate: '',
  // deploy info
  serverAddr: '',
  domain: '',
  adminUrl: '',
  adminUser: '',
  adminPass: '',
  // wechat
  wxAppId: '',
  wxAppSecret: '',
})

// wxPayParams: { k: string; v: string }[]
const wxPayRows = ref<{ k: string; v: string }[]>([])

const clientName = ref('')

const SECTIONS = [
  { key: 'basic', label: '基本信息' },
  { key: 'deploy', label: '部署信息' },
  { key: 'wx', label: '微信' },
  { key: 'payments', label: '收款记录' },
  { key: 'files', label: '合同' },
] as const
const activeSection = ref<(typeof SECTIONS)[number]['key']>('basic')

const dirty = ref(false)
const busy = ref(false)

// ── delete confirm ─────────────────────────────────────────────────────────────
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
    await window.api?.crm?.projects?.remove?.(props.refId)
    emit('removed')
  } catch (e) {
    console.warn('[ProjectEditor] remove error', e)
  } finally {
    busy.value = false
  }
}

// ── load ───────────────────────────────────────────────────────────────────────
function fillForm(p: CrmProject): void {
  form.name = p.name
  form.status = p.status
  form.description = p.description
  form.amountYuan = centsToYuan(p.amountCents)
  form.endDate = p.endDate
  form.serverAddr = p.serverAddr
  form.domain = p.domain
  form.adminUrl = p.adminUrl
  form.adminUser = p.adminUser
  form.adminPass = p.adminPass
  form.wxAppId = p.wxAppId
  form.wxAppSecret = p.wxAppSecret
  try {
    const parsed = JSON.parse(p.wxPayParams)
    wxPayRows.value = Array.isArray(parsed) ? parsed : []
  } catch {
    wxPayRows.value = []
  }
  dirty.value = false
}

// ── payments ───────────────────────────────────────────────────────────────────
const payments = ref<CrmPayment[]>([])

const totalPaidCents = computed(() =>
  payments.value.reduce((sum, p) => sum + p.amountCents, 0),
)

const amountCentsFromForm = computed(() => yuanToCents(form.amountYuan))

const unpaidCents = computed(() => amountCentsFromForm.value - totalPaidCents.value)

// new payment row
const newPayment = reactive({ amountYuan: '', paidAt: '', note: '' })
const addingPayment = ref(false)

async function addPayment(): Promise<void> {
  const cents = yuanToCents(newPayment.amountYuan)
  if (cents <= 0) return
  try {
    await window.api?.crm?.payments?.add?.(props.refId, {
      amountCents: cents,
      paidAt: newPayment.paidAt,
      note: newPayment.note,
    })
    newPayment.amountYuan = ''
    newPayment.paidAt = ''
    newPayment.note = ''
    addingPayment.value = false
    await loadPayments()
  } catch (e) {
    console.warn('[ProjectEditor] addPayment error', e)
  }
}

async function loadPayments(): Promise<void> {
  try {
    payments.value = (await window.api?.crm?.payments?.listByProject?.(props.refId)) ?? []
  } catch (e) {
    console.warn('[ProjectEditor] loadPayments error', e)
  }
}

// ── payment delete confirm ─────────────────────────────────────────────────────
const paymentDeleteConfirmId = ref<number | null>(null)
let paymentDeleteTimer: ReturnType<typeof setTimeout> | null = null

function startPaymentDelete(id: number): void {
  if (paymentDeleteConfirmId.value === id) {
    void executePaymentDelete(id)
    return
  }
  if (paymentDeleteTimer !== null) clearTimeout(paymentDeleteTimer)
  paymentDeleteConfirmId.value = id
  paymentDeleteTimer = setTimeout(() => {
    paymentDeleteConfirmId.value = null
    paymentDeleteTimer = null
  }, 3000)
}

async function executePaymentDelete(id: number): Promise<void> {
  if (paymentDeleteTimer !== null) {
    clearTimeout(paymentDeleteTimer)
    paymentDeleteTimer = null
  }
  paymentDeleteConfirmId.value = null
  try {
    await window.api?.crm?.payments?.remove?.(id)
    await loadPayments()
  } catch (e) {
    console.warn('[ProjectEditor] removePayment error', e)
  }
}

// ── files ──────────────────────────────────────────────────────────────────────
const files = ref<CrmFile[]>([])
const fileDeleteConfirmId = ref<number | null>(null)
let fileDeleteTimer: ReturnType<typeof setTimeout> | null = null

async function loadFiles(): Promise<void> {
  try {
    files.value = (await window.api?.crm?.files?.listByProject?.(props.refId)) ?? []
  } catch (e) {
    console.warn('[ProjectEditor] loadFiles error', e)
  }
}

async function pickFile(): Promise<void> {
  try {
    const file = await window.api?.crm?.files?.pick?.(props.refId)
    if (file) await loadFiles()
  } catch (e) {
    console.warn('[ProjectEditor] pickFile error', e)
  }
}

async function openFile(id: number): Promise<void> {
  try {
    await window.api?.crm?.files?.open?.(id)
  } catch (e) {
    console.warn('[ProjectEditor] openFile error', e)
  }
}

function startFileDelete(id: number): void {
  if (fileDeleteConfirmId.value === id) {
    void executeFileDelete(id)
    return
  }
  if (fileDeleteTimer !== null) clearTimeout(fileDeleteTimer)
  fileDeleteConfirmId.value = id
  fileDeleteTimer = setTimeout(() => {
    fileDeleteConfirmId.value = null
    fileDeleteTimer = null
  }, 3000)
}

async function executeFileDelete(id: number): Promise<void> {
  if (fileDeleteTimer !== null) {
    clearTimeout(fileDeleteTimer)
    fileDeleteTimer = null
  }
  fileDeleteConfirmId.value = null
  try {
    await window.api?.crm?.files?.remove?.(id)
    await loadFiles()
  } catch (e) {
    console.warn('[ProjectEditor] deleteFile error', e)
  }
}

// ── onMounted ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const project = await window.api?.crm?.projects?.get?.(props.refId) ?? null
    if (!project) {
      emit('removed')
      return
    }
    fillForm(project)
    const client = (await window.api?.crm?.clients?.get?.(project.clientId)) ?? null
    clientName.value = client?.name ?? ''
    await loadPayments()
    await loadFiles()
  } catch (e) {
    console.warn('[ProjectEditor] load error', e)
    emit('removed')
  }
})

// ── save (sections 1-3) ────────────────────────────────────────────────────────
async function save(): Promise<void> {
  if (!dirty.value || busy.value) return
  busy.value = true
  try {
    await window.api?.crm?.projects?.update?.(props.refId, {
      name: form.name,
      status: form.status,
      description: form.description,
      amountCents: yuanToCents(form.amountYuan),
      endDate: form.endDate,
      serverAddr: form.serverAddr,
      domain: form.domain,
      adminUrl: form.adminUrl,
      adminUser: form.adminUser,
      adminPass: form.adminPass,
      wxAppId: form.wxAppId,
      wxAppSecret: form.wxAppSecret,
      wxPayParams: JSON.stringify(wxPayRows.value),
    })
    dirty.value = false
    emit('rename', form.name)
  } catch (e) {
    console.warn('[ProjectEditor] save error', e)
  } finally {
    busy.value = false
  }
}

function markDirty(): void {
  dirty.value = true
}

// ── wxPayParams helpers ────────────────────────────────────────────────────────
function addWxPayRow(): void {
  wxPayRows.value.push({ k: '', v: '' })
  markDirty()
}

function removeWxPayRow(idx: number): void {
  wxPayRows.value.splice(idx, 1)
  markDirty()
}

// ── helpers ────────────────────────────────────────────────────────────────────
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN')
}

function formatSize(bytes: number): string {
  return (bytes / 1024).toFixed(1)
}
</script>

<template>
  <div class="tool-page project-editor">
    <!-- Sticky top bar -->
    <div class="top-bar">
      <span class="project-heading">{{ form.name || '项目' }}</span>
      <button class="btn btn-primary" :disabled="!dirty || busy" @click="save">保存</button>
      <button
        class="btn btn-danger"
        :class="{ confirming: deleteConfirming }"
        :disabled="busy"
        @click="startDelete"
      >{{ deleteConfirming ? '确认删除?' : '删除项目' }}</button>
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
        <span>所属客户</span>
        <span class="readonly-text">{{ clientName }}</span>
      </label>
      <label class="field">
        <span>名称</span>
        <input v-model="form.name" class="input" type="text" @input="markDirty" />
      </label>

      <label class="field">
        <span>状态</span>
        <select v-model="form.status" class="input" @change="markDirty">
          <option value="active">进行中</option>
          <option value="done">已完结</option>
        </select>
      </label>

      <label class="field field-textarea">
        <span>情况说明</span>
        <textarea v-model="form.description" class="input" rows="3" @input="markDirty" />
      </label>

      <label class="field">
        <span>项目金额</span>
        <input v-model="form.amountYuan" class="input" type="text" placeholder="0.00" @input="markDirty" />
      </label>

      <label class="field">
        <span>结束时间</span>
        <input v-model="form.endDate" class="input" type="date" @input="markDirty" />
      </label>
    </div>

    <!-- Section 2: 部署信息 -->
    <div v-show="activeSection === 'deploy'">
      <label class="field">
        <span>服务器地址</span>
        <input v-model="form.serverAddr" class="input" type="text" @input="markDirty" />
      </label>

      <label class="field">
        <span>域名</span>
        <input v-model="form.domain" class="input" type="text" @input="markDirty" />
      </label>

      <label class="field">
        <span>后台访问地址</span>
        <input v-model="form.adminUrl" class="input" type="text" @input="markDirty" />
      </label>

      <label class="field">
        <span>访问用户</span>
        <input v-model="form.adminUser" class="input" type="text" @input="markDirty" />
      </label>

      <label class="field">
        <span>访问密码</span>
        <SecretInput v-model="form.adminPass" @update:model-value="markDirty" />
      </label>
    </div>

    <!-- Section 3: 微信 -->
    <div v-show="activeSection === 'wx'">
      <label class="field">
        <span>appId</span>
        <input v-model="form.wxAppId" class="input" type="text" @input="markDirty" />
      </label>

      <label class="field">
        <span>appSecret</span>
        <SecretInput v-model="form.wxAppSecret" @update:model-value="markDirty" />
      </label>

      <div class="wx-pay-params">
        <div class="wx-pay-title">支付参数</div>
        <div v-for="(row, idx) in wxPayRows" :key="idx" class="wx-pay-row">
          <input
            v-model="row.k"
            class="input wx-key-input"
            type="text"
            placeholder="参数名"
            @input="markDirty"
          />
          <SecretInput v-model="row.v" @update:model-value="markDirty" />
          <button type="button" class="icon-btn remove-btn" title="删除" @click="removeWxPayRow(idx)">×</button>
        </div>
        <button type="button" class="btn btn-add" @click="addWxPayRow">＋ 添加参数</button>
      </div>
    </div>

    <!-- Section 4: 收款记录 -->
    <div v-show="activeSection === 'payments'">
      <table class="payments-table">
        <thead>
          <tr>
            <th>金额 (元)</th>
            <th>日期</th>
            <th>备注</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pay in payments" :key="pay.id">
            <td>{{ centsToYuan(pay.amountCents) }}</td>
            <td>{{ pay.paidAt }}</td>
            <td>{{ pay.note }}</td>
            <td>
              <button
                type="button"
                class="icon-btn remove-btn"
                :class="{ confirming: paymentDeleteConfirmId === pay.id }"
                @click="startPaymentDelete(pay.id)"
              >{{ paymentDeleteConfirmId === pay.id ? '确认?' : '×' }}</button>
            </td>
          </tr>
          <!-- Inline add row -->
          <tr v-if="addingPayment">
            <td>
              <input v-model="newPayment.amountYuan" class="input cell-input" type="text" placeholder="0.00" />
            </td>
            <td>
              <input v-model="newPayment.paidAt" class="input cell-input" type="date" />
            </td>
            <td>
              <input v-model="newPayment.note" class="input cell-input" type="text" placeholder="备注" />
            </td>
            <td>
              <button type="button" class="btn btn-primary btn-sm" @click="addPayment">确认</button>
            </td>
          </tr>
        </tbody>
      </table>

      <button v-if="!addingPayment" type="button" class="btn btn-add" @click="addingPayment = true">＋ 添加收款</button>

      <div class="payment-summary">
        <span>已收合计 ¥{{ centsToYuan(totalPaidCents) }}</span>
        <span class="divider">／</span>
        <span :class="{ error: unpaidCents < 0 }">未收 ¥{{ centsToYuan(unpaidCents) }}</span>
      </div>
    </div>

    <!-- Section 5: 合同 -->
    <div v-show="activeSection === 'files'">
      <div v-if="files.length > 0" class="files-list">
        <div v-for="file in files" :key="file.id" class="file-row">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-meta">{{ formatSize(file.size) }} KB</span>
          <span class="file-meta">{{ formatDate(file.uploadedAt) }}</span>
          <button type="button" class="btn btn-sm" @click="openFile(file.id)">打开</button>
          <button
            type="button"
            class="btn btn-sm btn-danger"
            :class="{ confirming: fileDeleteConfirmId === file.id }"
            @click="startFileDelete(file.id)"
          >{{ fileDeleteConfirmId === file.id ? '确认?' : '×' }}</button>
        </div>
      </div>
      <p v-else class="empty-hint">暂无合同</p>

      <button type="button" class="btn btn-add" @click="pickFile">上传合同</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.project-editor {
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

    .project-heading {
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

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;

    > span {
      color: var(--fg-dim);
      width: 5.5em;
      flex-shrink: 0;
    }

    .input {
      flex: 1;
      min-width: 0;
    }

    .readonly-text {
      flex: 1;
      color: var(--fg-dim);
    }

    &.field-textarea {
      align-items: flex-start;

      > span {
        padding-top: 4px;
      }
    }
  }

  // wx pay params
  .wx-pay-params {
    margin-bottom: 10px;

    .wx-pay-title {
      font-size: 12px;
      color: var(--fg-dim);
      margin-bottom: 6px;
    }

    .wx-pay-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;

      .wx-key-input {
        width: 7em;
        flex-shrink: 0;
      }
    }
  }

  // payments table
  .payments-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-bottom: 6px;

    th {
      text-align: left;
      color: var(--fg-dim);
      font-weight: 500;
      padding: 4px 6px;
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 4px 6px;
      vertical-align: middle;
    }

    .cell-input {
      width: 100%;
      min-width: 0;
    }
  }

  .payment-summary {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    margin: 8px 0 4px;

    .divider {
      color: var(--fg-dim);
    }

    .error {
      color: #e55;
      font-weight: 600;
    }
  }

  // files list
  .files-list {
    margin-bottom: 8px;

    .file-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      border-bottom: 1px solid var(--border);

      .file-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
      }

      .file-meta {
        font-size: 12px;
        color: var(--fg-dim);
        white-space: nowrap;
      }
    }
  }

  .empty-hint {
    font-size: 12px;
    color: var(--fg-dim);
    margin-bottom: 8px;
  }

  // shared button styles
  .btn-add {
    font-size: 12px;
    color: var(--accent, #4a90e2);
    background: none;
    border: 1px dashed var(--border);
    border-radius: 4px;
    padding: 4px 10px;
    cursor: pointer;
    margin-bottom: 4px;

    &:hover {
      background: color-mix(in srgb, var(--accent, #4a90e2) 8%, transparent);
    }
  }

  .btn-sm {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 3px;
    border: 1px solid var(--border);
    cursor: pointer;
    background: none;

    &:hover:not(:disabled) {
      background: var(--border, #eee);
    }
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

    &:hover:not(:disabled) {
      background: color-mix(in srgb, #e55 12%, transparent);
    }

    &.confirming {
      background: color-mix(in srgb, #e55 18%, transparent);
      font-weight: 600;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 5px;
    opacity: 0.6;
    border-radius: 3px;
    line-height: 1;
    flex-shrink: 0;

    &:hover {
      opacity: 1;
      background: var(--border, #eee);
    }

    &.remove-btn {
      color: #e55;
    }

    &.remove-btn.confirming {
      opacity: 1;
      font-size: 12px;
      font-weight: 600;
      background: color-mix(in srgb, #e55 18%, transparent);
      padding: 1px 6px;
    }
  }
}
</style>
