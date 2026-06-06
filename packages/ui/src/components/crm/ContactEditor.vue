<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { CrmContact } from '@lele/shared-types'

const props = defineProps<{ refId: number }>()
const emit = defineEmits<{ rename: [title: string]; removed: [] }>()

// ── form state ─────────────────────────────────────────────────────────────────
const form = reactive({
  name: '',
  role: '',
  phone: '',
  wechat: '',
  email: '',
  sex: '' as '' | 'male' | 'female',
  note: '',
})

const clientName = ref('')
const dirty = ref(false)
const busy = ref(false)

// ── delete confirm (3s timeout pattern) ───────────────────────────────────────
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
    await window.api?.crm?.contacts?.remove?.(props.refId)
    emit('removed')
  } catch (e) {
    console.warn('[ContactEditor] remove error', e)
  } finally {
    busy.value = false
  }
}

// ── load ───────────────────────────────────────────────────────────────────────
function fillForm(contact: CrmContact): void {
  form.name = contact.name
  form.role = contact.role
  form.phone = contact.phone
  form.wechat = contact.wechat
  form.email = contact.email
  form.sex = contact.sex
  form.note = contact.note
  dirty.value = false
}

onMounted(async () => {
  try {
    const contact = await window.api?.crm?.contacts?.get?.(props.refId) ?? null
    if (!contact) {
      emit('removed')
      return
    }
    fillForm(contact)
    const client = (await window.api?.crm?.clients?.get?.(contact.clientId)) ?? null
    clientName.value = client?.name ?? ''
  } catch (e) {
    console.warn('[ContactEditor] load error', e)
    emit('removed')
  }
})

// ── save ───────────────────────────────────────────────────────────────────────
async function save(): Promise<void> {
  if (!dirty.value || busy.value) return
  busy.value = true
  try {
    await window.api?.crm?.contacts?.update?.(props.refId, {
      name: form.name,
      role: form.role,
      phone: form.phone,
      wechat: form.wechat,
      email: form.email,
      sex: form.sex,
      note: form.note,
    })
    dirty.value = false
    emit('rename', form.name)
  } catch (e) {
    console.warn('[ContactEditor] save error', e)
  } finally {
    busy.value = false
  }
}

function markDirty(): void {
  dirty.value = true
}
</script>

<template>
  <div class="tool-page contact-editor">
    <!-- Sticky top bar -->
    <div class="top-bar">
      <span class="contact-heading">{{ form.name || '干系人' }}</span>
      <button class="btn btn-primary" :disabled="!dirty || busy" @click="save">保存</button>
      <button
        class="btn btn-danger"
        :class="{ confirming: deleteConfirming }"
        :disabled="busy"
        @click="startDelete"
      >{{ deleteConfirming ? '确认删除?' : '删除干系人' }}</button>
    </div>

    <!-- Fields -->
    <label class="field">
      <span>客户</span>
      <span class="readonly-text">{{ clientName }}</span>
    </label>
    <label class="field">
      <span>姓名</span>
      <input v-model="form.name" class="input" type="text" @input="markDirty" />
    </label>
    <label class="field">
      <span>职位</span>
      <input v-model="form.role" class="input" type="text" @input="markDirty" />
    </label>
    <label class="field">
      <span>性别</span>
      <select v-model="form.sex" class="input" @change="markDirty">
        <option value="">—</option>
        <option value="male">男</option>
        <option value="female">女</option>
      </select>
    </label>
    <label class="field">
      <span>电话</span>
      <input v-model="form.phone" class="input" type="text" @input="markDirty" />
    </label>
    <label class="field">
      <span>微信</span>
      <input v-model="form.wechat" class="input" type="text" @input="markDirty" />
    </label>
    <label class="field">
      <span>邮箱</span>
      <input v-model="form.email" class="input" type="email" @input="markDirty" />
    </label>
    <label class="field field-textarea">
      <span>备注</span>
      <textarea v-model="form.note" class="input" rows="4" @input="markDirty" />
    </label>
  </div>
</template>

<style scoped lang="scss">
.contact-editor {
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

    .contact-heading {
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

    .input {
      flex: 1;
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
}
</style>
