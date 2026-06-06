<script setup lang="ts">
import { ref } from 'vue'
import type { CrmClient, CrmContact, CrmProjectLite } from '@lele/shared-types'
import { locale, t } from '../i18n'

const emit = defineEmits<{
  open: [kind: 'crm-contact' | 'crm-project', id: number, name: string]
}>()

// ── state ─────────────────────────────────────────────────────────────────────
const clients = ref<CrmClient[]>([])
const expanded = ref(new Set<number>())
type ChildCache = Map<number, { contacts: CrmContact[]; projects: CrmProjectLite[] }>
const childCache = ref<ChildCache>(new Map())

// add-client inline form
const addingClient = ref(false)
const newClientName = ref('')
const newClientType = ref<'company' | 'person'>('company')
const addClientError = ref('')

// add-child inline forms: key = `contact:${clientId}` | `project:${clientId}`
const addingChild = ref<string | null>(null)
const newChildName = ref('')
const addChildError = ref('')

// delete confirmation state: key = `client:${id}` | `contact:${id}` | `project:${id}`
const pendingDelete = ref<string | null>(null)
const deleteTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ── data loading ───────────────────────────────────────────────────────────────
async function loadClients(): Promise<void> {
  try {
    const list = await window.api?.crm?.clients?.list?.() ?? []
    clients.value = list
  } catch (e) {
    console.warn('[CrmTree] loadClients error', e)
  }
}

async function loadChildren(clientId: number): Promise<void> {
  try {
    const [contacts, projects] = await Promise.all([
      window.api?.crm?.contacts?.listByClient?.(clientId) ?? [],
      window.api?.crm?.projects?.listByClient?.(clientId) ?? [],
    ])
    childCache.value = new Map(childCache.value).set(clientId, { contacts, projects })
  } catch (e) {
    console.warn('[CrmTree] loadChildren error', e)
  }
}

async function refresh(): Promise<void> {
  await loadClients()
  // Reload children for currently expanded clients
  for (const id of expanded.value) {
    await loadChildren(id)
  }
}

// Initial load
void loadClients()

// ── expand / collapse ──────────────────────────────────────────────────────────
async function toggleExpand(clientId: number): Promise<void> {
  const next = new Set(expanded.value)
  if (next.has(clientId)) {
    next.delete(clientId)
  } else {
    next.add(clientId)
    if (!childCache.value.has(clientId)) {
      await loadChildren(clientId)
    }
  }
  expanded.value = next
}

// ── add client ─────────────────────────────────────────────────────────────────
function startAddClient(): void {
  addingClient.value = true
  newClientName.value = ''
  newClientType.value = 'company'
  addClientError.value = ''
}

function cancelAddClient(): void {
  addingClient.value = false
  addClientError.value = ''
}

async function confirmAddClient(): Promise<void> {
  const name = newClientName.value.trim()
  if (!name) return
  addClientError.value = ''
  try {
    await window.api?.crm?.clients?.create?.(name, newClientType.value)
    addingClient.value = false
    await loadClients()
  } catch (e) {
    console.warn('[CrmTree] create client error', e)
    addClientError.value = String(e)
  }
}

// ── add contact / project ──────────────────────────────────────────────────────
function startAddChild(kind: 'contact' | 'project', clientId: number): void {
  addingChild.value = `${kind}:${clientId}`
  newChildName.value = ''
  addChildError.value = ''
}

function cancelAddChild(): void {
  addingChild.value = null
  addChildError.value = ''
}

async function confirmAddChild(kind: 'contact' | 'project', clientId: number): Promise<void> {
  const name = newChildName.value.trim()
  if (!name) return
  addChildError.value = ''
  try {
    let newId: number
    if (kind === 'contact') {
      newId = await window.api?.crm?.contacts?.create?.(clientId, name) ?? 0
    } else {
      newId = await window.api?.crm?.projects?.create?.(clientId, name) ?? 0
    }
    addingChild.value = null
    await loadChildren(clientId)
    const emitKind = kind === 'contact' ? 'crm-contact' : 'crm-project'
    if (newId) emit('open', emitKind, newId, name)
  } catch (e) {
    console.warn('[CrmTree] create child error', e)
    addChildError.value = String(e)
  }
}

// ── delete with 2-step confirm ─────────────────────────────────────────────────
function startDelete(key: string): void {
  // Clear any existing timer for other keys
  if (pendingDelete.value && pendingDelete.value !== key) {
    clearTimer(pendingDelete.value)
    pendingDelete.value = null
  }
  if (pendingDelete.value === key) {
    // Second click — execute delete
    void executeDelete(key)
    return
  }
  pendingDelete.value = key
  const timer = setTimeout(() => {
    if (pendingDelete.value === key) pendingDelete.value = null
    deleteTimers.delete(key)
  }, 3000)
  deleteTimers.set(key, timer)
}

function clearTimer(key: string): void {
  const t = deleteTimers.get(key)
  if (t !== undefined) {
    clearTimeout(t)
    deleteTimers.delete(key)
  }
}

async function executeDelete(key: string): Promise<void> {
  clearTimer(key)
  pendingDelete.value = null
  const [kind, idStr] = key.split(':') as [string, string]
  const id = Number(idStr)
  try {
    if (kind === 'client') {
      await window.api?.crm?.clients?.remove?.(id)
      // Remove from expanded + cache
      const next = new Set(expanded.value)
      next.delete(id)
      expanded.value = next
      const nextCache = new Map(childCache.value)
      nextCache.delete(id)
      childCache.value = nextCache
      await loadClients()
    } else if (kind === 'contact') {
      await window.api?.crm?.contacts?.remove?.(id)
      // find which client owns this and reload
      for (const [cid, cache] of childCache.value) {
        if (cache.contacts.some((c) => c.id === id)) {
          await loadChildren(cid)
          break
        }
      }
    } else if (kind === 'project') {
      await window.api?.crm?.projects?.remove?.(id)
      for (const [cid, cache] of childCache.value) {
        if (cache.projects.some((p) => p.id === id)) {
          await loadChildren(cid)
          break
        }
      }
    }
  } catch (e) {
    console.warn('[CrmTree] delete error', e)
  }
}

defineExpose({ refresh })
</script>

<template>
  <div class="crm-tree">
    <!-- Header row -->
    <div class="crm-header">
      <span class="crm-title">{{ t('crm.title') }}</span>
      <button class="btn-icon" :title="t('crm.addClient')" @click="startAddClient">＋</button>
    </div>

    <!-- Inline add-client form -->
    <div v-if="addingClient" class="inline-form">
      <input
        v-model="newClientName"
        class="inline-input"
        :placeholder="t('crm.addClient')"
        autofocus
        @keydown.enter="confirmAddClient"
        @keydown.esc="cancelAddClient"
      />
      <select v-model="newClientType" class="inline-select">
        <option value="company">{{ t('crm.company') }}</option>
        <option value="person">{{ t('crm.person') }}</option>
      </select>
      <button class="btn-icon" @click="confirmAddClient">✓</button>
      <button class="btn-icon" @click="cancelAddClient">✕</button>
      <span v-if="addClientError" class="error">{{ addClientError }}</span>
    </div>

    <!-- Client list -->
    <div v-for="client in clients" :key="client.id" class="client-block">
      <!-- Client row -->
      <div class="tree-row depth-0" @click="toggleExpand(client.id)">
        <span class="arrow">{{ expanded.has(client.id) ? '▾' : '▸' }}</span>
        <span class="row-icon">{{ client.type === 'company' ? '🏢' : '👤' }}</span>
        <span class="row-label">{{ client.name }}</span>
        <button
          class="btn-del"
          :class="{ confirming: pendingDelete === `client:${client.id}` }"
          :title="pendingDelete === `client:${client.id}` ? t('crm.confirmDelete') : '删除'"
          @click.stop="startDelete(`client:${client.id}`)"
        >{{ pendingDelete === `client:${client.id}` ? t('crm.confirmDelete') : '×' }}</button>
      </div>

      <!-- Expanded subtree -->
      <template v-if="expanded.has(client.id) && childCache.has(client.id)">
        <!-- Contacts section -->
        <div class="tree-row depth-1 section-header">
          <span class="section-label">{{ t('crm.contacts') }}</span>
          <button class="btn-icon small" :title="'新建' + t('crm.contacts')" @click.stop="startAddChild('contact', client.id)">＋</button>
        </div>

        <!-- Inline add contact -->
        <div v-if="addingChild === `contact:${client.id}`" class="inline-form depth-2">
          <input
            v-model="newChildName"
            class="inline-input"
            :placeholder="locale === 'zh' ? '干系人名称' : 'Contact name'"
            autofocus
            @keydown.enter="confirmAddChild('contact', client.id)"
            @keydown.esc="cancelAddChild"
          />
          <button class="btn-icon" @click="confirmAddChild('contact', client.id)">✓</button>
          <button class="btn-icon" @click="cancelAddChild">✕</button>
          <span v-if="addChildError" class="error">{{ addChildError }}</span>
        </div>

        <div
          v-for="contact in childCache.get(client.id)!.contacts"
          :key="contact.id"
          class="tree-row depth-2"
          @click="emit('open', 'crm-contact', contact.id, contact.name)"
        >
          <span class="row-icon">👤</span>
          <span class="row-label">{{ contact.name }}</span>
          <button
            class="btn-del"
            :class="{ confirming: pendingDelete === `contact:${contact.id}` }"
            :title="pendingDelete === `contact:${contact.id}` ? t('crm.confirmDelete') : '删除'"
            @click.stop="startDelete(`contact:${contact.id}`)"
          >{{ pendingDelete === `contact:${contact.id}` ? t('crm.confirmDelete') : '×' }}</button>
        </div>

        <!-- Projects section -->
        <div class="tree-row depth-1 section-header">
          <span class="section-label">{{ t('crm.projects') }}</span>
          <button class="btn-icon small" :title="'新建' + t('crm.projects')" @click.stop="startAddChild('project', client.id)">＋</button>
        </div>

        <!-- Inline add project -->
        <div v-if="addingChild === `project:${client.id}`" class="inline-form depth-2">
          <input
            v-model="newChildName"
            class="inline-input"
            :placeholder="locale === 'zh' ? '项目名称' : 'Project name'"
            autofocus
            @keydown.enter="confirmAddChild('project', client.id)"
            @keydown.esc="cancelAddChild"
          />
          <button class="btn-icon" @click="confirmAddChild('project', client.id)">✓</button>
          <button class="btn-icon" @click="cancelAddChild">✕</button>
          <span v-if="addChildError" class="error">{{ addChildError }}</span>
        </div>

        <div
          v-for="project in childCache.get(client.id)!.projects"
          :key="project.id"
          class="tree-row depth-2"
          @click="emit('open', 'crm-project', project.id, project.name)"
        >
          <span class="row-icon">📁</span>
          <span class="row-label">{{ project.name }}</span>
          <span v-if="project.status === 'done'" class="badge done">{{ locale === 'zh' ? '完结' : 'done' }}</span>
          <button
            class="btn-del"
            :class="{ confirming: pendingDelete === `project:${project.id}` }"
            :title="pendingDelete === `project:${project.id}` ? t('crm.confirmDelete') : '删除'"
            @click.stop="startDelete(`project:${project.id}`)"
          >{{ pendingDelete === `project:${project.id}` ? t('crm.confirmDelete') : '×' }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.crm-tree {
  padding-bottom: 12px;

  .crm-header {
    display: flex;
    align-items: center;
    padding: 10px 12px 4px;
    gap: 4px;

    .crm-title {
      flex: 1;
      font-size: 11px;
      color: var(--fg-dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }

  .inline-form {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px 4px 24px;
    flex-wrap: wrap;

    &.depth-2 { padding-left: 46px; }

    .inline-input {
      flex: 1;
      min-width: 80px;
      font-size: 12px;
      padding: 2px 6px;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: var(--bg);
      color: var(--fg);
      outline: none;
      &:focus { border-color: var(--accent, #4a9eff); }
    }

    .inline-select {
      font-size: 12px;
      padding: 2px 4px;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: var(--bg);
      color: var(--fg);
    }

    .error {
      width: 100%;
      font-size: 11px;
      color: #e55;
      padding-left: 2px;
    }
  }

  .client-block {
    // groups a client + its children
  }

  .tree-row {
    display: flex;
    align-items: center;
    padding: 4px 12px;
    cursor: pointer;
    user-select: none;
    gap: 2px;

    &:hover {
      background: var(--bg-hover);

      .btn-del { opacity: 1; }
    }

    &.depth-0 { padding-left: 12px; }
    &.depth-1 { padding-left: 24px; }
    &.depth-2 { padding-left: 36px; }

    &.section-header {
      cursor: default;
      padding-top: 3px;
      padding-bottom: 3px;

      &:hover { background: none; }

      .section-label {
        flex: 1;
        font-size: 11px;
        color: var(--fg-dim);
      }
    }

    .arrow {
      font-size: 10px;
      color: var(--fg-dim);
      width: 14px;
      flex-shrink: 0;
    }

    .row-icon {
      font-size: 13px;
      width: 18px;
      flex-shrink: 0;
      text-align: center;
    }

    .row-label {
      flex: 1;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .badge {
      font-size: 10px;
      padding: 0 4px;
      border-radius: 3px;
      flex-shrink: 0;

      &.done {
        background: var(--fg-dim, #888);
        color: var(--bg, #fff);
        opacity: 0.7;
      }
    }

    .btn-del {
      opacity: 0;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--fg-dim);
      font-size: 13px;
      padding: 0 4px;
      border-radius: 3px;
      flex-shrink: 0;
      transition: opacity 0.1s;

      &:hover { color: #e55; }

      &.confirming {
        opacity: 1;
        color: #e55;
        font-size: 11px;
        background: color-mix(in srgb, #e55 12%, transparent);
        padding: 1px 5px;
      }
    }
  }

  .btn-icon {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--fg-dim);
    font-size: 14px;
    padding: 1px 4px;
    border-radius: 3px;
    line-height: 1;

    &:hover { background: var(--bg-hover); color: var(--fg); }

    &.small { font-size: 12px; opacity: 0; }
  }

  .tree-row:hover .btn-icon.small { opacity: 1; }
}
</style>
