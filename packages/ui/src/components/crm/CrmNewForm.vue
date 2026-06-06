<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { CrmClient, CrmClientSource } from '@lele/shared-types'
import { t } from '../../i18n'
import { yuanToCents } from '../../money'
import { CLIENT_SOURCES, sourceLabel } from './options'

const props = defineProps<{ entity: 'client' | 'contact' | 'project'; presetClientId?: number }>()
const emit = defineEmits<{ created: [id: number, title: string] }>()

const name = ref('')
const clientId = ref<number>(props.presetClientId ?? 0)
const clients = ref<CrmClient[]>([])
const busy = ref(false)

// 各实体的选填字段（必填只有 name 与 clientId）
const client = reactive({
  type: 'company' as 'company' | 'person',
  phone: '',
  email: '',
  legalPerson: '',
  legalPersonPhone: '',
  uscc: '',
  regAddress: '',
  establishedDate: '',
  source: '' as CrmClientSource,
})
const contact = reactive({
  wechat: '',
  phone: '',
  sex: '' as '' | 'male' | 'female',
  role: '',
  email: '',
  note: '',
})
const project = reactive({
  status: 'active' as 'active' | 'done',
  amountYuan: '',
  shareYuan: '',
  endDate: '',
  description: '',
})

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
      id = await window.api?.crm?.clients?.create?.({
        name: n,
        type: client.type,
        phone: client.phone,
        email: client.email,
        legalPerson: client.legalPerson,
        legalPersonPhone: client.legalPersonPhone,
        uscc: client.uscc,
        regAddress: client.regAddress,
        establishedDate: client.establishedDate,
        source: client.source,
      })
    } else if (props.entity === 'contact') {
      id = await window.api?.crm?.contacts?.create?.(clientId.value, {
        name: n,
        wechat: contact.wechat,
        phone: contact.phone,
        sex: contact.sex,
        role: contact.role,
        email: contact.email,
        note: contact.note,
      })
    } else {
      id = await window.api?.crm?.projects?.create?.(clientId.value, {
        name: n,
        status: project.status,
        description: project.description,
        amountCents: yuanToCents(project.amountYuan),
        shareCents: yuanToCents(project.shareYuan),
        endDate: project.endDate,
      })
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
    <label v-if="needClient" class="field">
      <span>{{ t('crm.client') }}</span>
      <select v-model.number="clientId" class="input">
        <option :value="0" disabled>—</option>
        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>

    <!-- 客户 -->
    <template v-if="entity === 'client'">
      <label class="field">
        <span>{{ t('crm.type') }}</span>
        <select v-model="client.type" class="input">
          <option value="company">{{ t('crm.company') }}</option>
          <option value="person">{{ t('crm.person') }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ t('crm.source') }}</span>
        <select v-model="client.source" class="input">
          <option value="">—</option>
          <option v-for="srcKey in CLIENT_SOURCES" :key="srcKey" :value="srcKey">{{ sourceLabel(srcKey) }}</option>
        </select>
      </label>
      <template v-if="client.type === 'person'">
        <label class="field">
          <span>{{ t('crm.mobile') }}</span>
          <input v-model="client.phone" class="input" type="text" />
        </label>
      </template>
      <template v-else>
        <label class="field">
          <span>{{ t('crm.legalPerson') }}</span>
          <input v-model="client.legalPerson" class="input" type="text" />
        </label>
        <label class="field">
          <span>{{ t('crm.legalPersonPhone') }}</span>
          <input v-model="client.legalPersonPhone" class="input" type="text" />
        </label>
        <label class="field">
          <span>{{ t('crm.uscc') }}</span>
          <input v-model="client.uscc" class="input" type="text" />
        </label>
        <label class="field">
          <span>{{ t('crm.regAddress') }}</span>
          <input v-model="client.regAddress" class="input" type="text" />
        </label>
        <label class="field">
          <span>{{ t('crm.establishedDate') }}</span>
          <input v-model="client.establishedDate" class="input" type="date" />
        </label>
      </template>
      <label class="field">
        <span>{{ t('crm.email') }}</span>
        <input v-model="client.email" class="input" type="email" />
      </label>
    </template>

    <!-- 干系人 -->
    <template v-else-if="entity === 'contact'">
      <label class="field">
        <span>{{ t('crm.wechat') }}</span>
        <input v-model="contact.wechat" class="input" type="text" />
      </label>
      <label class="field">
        <span>{{ t('crm.mobile') }}</span>
        <input v-model="contact.phone" class="input" type="text" />
      </label>
      <label class="field">
        <span>{{ t('crm.sex') }}</span>
        <select v-model="contact.sex" class="input">
          <option value="">—</option>
          <option value="male">{{ t('crm.male') }}</option>
          <option value="female">{{ t('crm.female') }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ t('crm.role') }}</span>
        <input v-model="contact.role" class="input" type="text" />
      </label>
      <label class="field">
        <span>{{ t('crm.email') }}</span>
        <input v-model="contact.email" class="input" type="email" />
      </label>
      <label class="field field-textarea">
        <span>{{ t('crm.note') }}</span>
        <textarea v-model="contact.note" class="input" rows="3" />
      </label>
    </template>

    <!-- 项目 -->
    <template v-else>
      <label class="field">
        <span>{{ t('crm.status') }}</span>
        <select v-model="project.status" class="input">
          <option value="active">{{ t('crm.statusActive') }}</option>
          <option value="done">{{ t('crm.statusDone') }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ t('crm.amount') }}</span>
        <input v-model="project.amountYuan" class="input" type="text" placeholder="0.00" />
      </label>
      <label class="field">
        <span>{{ t('crm.shareAmount') }}</span>
        <input v-model="project.shareYuan" class="input" type="text" placeholder="0.00" />
      </label>
      <label class="field">
        <span>{{ t('crm.endDate') }}</span>
        <input v-model="project.endDate" class="input" type="date" />
      </label>
      <label class="field field-textarea">
        <span>{{ t('crm.note') }}</span>
        <textarea v-model="project.description" class="input" rows="3" />
      </label>
    </template>

    <div class="actions">
      <button class="btn btn-primary" :disabled="!canSave || busy" @click="save">保存</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.crm-new-form {
  max-width: 520px;

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
      width: 8em;
      flex-shrink: 0;
    }

    .input { flex: 1; min-width: 0; }

    &.field-textarea {
      align-items: flex-start;

      > span { padding-top: 4px; }
    }
  }

  .actions { padding-left: calc(8em + 12px); }
}
</style>
