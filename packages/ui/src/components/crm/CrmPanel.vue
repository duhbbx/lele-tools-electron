<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { t } from '../../i18n'
import ToolTabs from '../ToolTabs.vue'
import ClientEditor from './ClientEditor.vue'
import ClientList from './ClientList.vue'
import ContactEditor from './ContactEditor.vue'
import ContactList from './ContactList.vue'
import CrmNewForm from './CrmNewForm.vue'
import DocList from './DocList.vue'
import ProjectEditor from './ProjectEditor.vue'
import ProjectList from './ProjectList.vue'

type Entity = 'client' | 'contact' | 'project'
type CrmTabComp =
  | 'client-list'
  | 'contact-list'
  | 'project-list'
  | 'doc-list'
  | 'client'
  | 'contact'
  | 'project'
  | 'new'

interface CrmTab {
  /** list:clients | client:<id> | new:client:<seq> … */
  key: string
  comp: CrmTabComp
  /** 详情 tab 的实体 id */
  refId?: number
  /** new tab 专用 */
  entity?: Entity
  presetClientId?: number
  title: string
  icon: string
}

const tabs = ref<CrmTab[]>([])
const active = ref<string | null>(null)
/** 任何保存/删除/新建后 +1，列表与客户详情关联区块据此刷新 */
const refreshTick = ref(0)
let newSeq = 0

const ENTITY_ICON: Record<Entity, string> = { client: '🏢', contact: '👤', project: '📁' }

const NAV = [
  { key: 'list:clients', comp: 'client-list', icon: '🏢', labelKey: 'crm.clients' },
  { key: 'list:contacts', comp: 'contact-list', icon: '👤', labelKey: 'crm.contacts' },
  { key: 'list:projects', comp: 'project-list', icon: '📁', labelKey: 'crm.projects' },
  { key: 'list:docs', comp: 'doc-list', icon: '📄', labelKey: 'crm.docs' },
] as const

onMounted(() => openList(NAV[0]))

// 切回列表 tab 时自动按当前筛选条件重新查询（详情里改完数据回来即见最新）
watch(active, (key) => {
  if (key?.startsWith('list:')) refreshTick.value++
})

function openList(nav: (typeof NAV)[number]): void {
  if (!tabs.value.find((x) => x.key === nav.key)) {
    tabs.value = [...tabs.value, { key: nav.key, comp: nav.comp, title: t(nav.labelKey), icon: nav.icon }]
  }
  active.value = nav.key
}

function openDetail(entity: Entity, id: number, title: string): void {
  const key = `${entity}:${id}`
  const existing = tabs.value.find((x) => x.key === key)
  if (existing) {
    existing.title = title
    active.value = key
    return
  }
  tabs.value = [...tabs.value, { key, comp: entity, refId: id, title, icon: ENTITY_ICON[entity] }]
  active.value = key
}

function openNew(entity: Entity, presetClientId?: number): void {
  newSeq += 1
  const key = `new:${entity}:${newSeq}`
  tabs.value = [
    ...tabs.value,
    { key, comp: 'new', entity, presetClientId, title: t('crm.add'), icon: '＋' },
  ]
  active.value = key
}

/** 新增 tab 保存成功：原地变身详情 tab（key 变化触发重挂载，详情组件自行加载完整数据） */
function onCreated(tab: CrmTab, id: number, title: string): void {
  const entity = tab.entity as Entity
  const detailKey = `${entity}:${id}`
  tab.key = detailKey
  tab.comp = entity
  tab.refId = id
  tab.title = title
  tab.icon = ENTITY_ICON[entity]
  active.value = detailKey
  refreshTick.value++
}

function onRenamed(tab: CrmTab, title: string): void {
  tab.title = title
  refreshTick.value++
}

function onRemoved(tab: CrmTab): void {
  close(tab.key)
  refreshTick.value++
}

/** 列表里删除：把已打开的对应详情 tab 关掉 */
function onListDeleted(entity: Entity, id: number): void {
  close(`${entity}:${id}`)
  refreshTick.value++
}

function close(key: string): void {
  tabs.value = tabs.value.filter((x) => x.key !== key)
  if (active.value === key) active.value = tabs.value[tabs.value.length - 1]?.key ?? null
}

function reorder(fromKey: string, toKey: string): void {
  const arr = [...tabs.value]
  const fromIdx = arr.findIndex((x) => x.key === fromKey)
  const toIdx = arr.findIndex((x) => x.key === toKey)
  if (fromIdx === -1 || toIdx === -1) return
  const [item] = arr.splice(fromIdx, 1)
  arr.splice(toIdx, 0, item!)
  tabs.value = arr
}
</script>

<template>
  <div class="crm-panel">
    <nav class="crm-nav">
      <button
        v-for="n in NAV"
        :key="n.key"
        class="nav-item"
        :class="{ active: active === n.key }"
        @click="openList(n)"
      >
        <span class="icon">{{ n.icon }}</span>{{ t(n.labelKey) }}
      </button>
    </nav>
    <div class="crm-main">
      <ToolTabs
        class="inner-tabs"
        :tabs="tabs.map((x) => ({ key: x.key, title: x.title, icon: x.icon }))"
        :active="active"
        @activate="active = $event"
        @close="close"
        @reorder="reorder"
      />
      <div class="crm-body">
        <div v-if="!tabs.length" class="welcome">{{ t('crm.hint') }}</div>
        <div v-for="tab in tabs" v-show="tab.key === active" :key="tab.key" class="pane">
          <ClientList
            v-if="tab.comp === 'client-list'"
            :refresh-tick="refreshTick"
            @open="(id, title) => openDetail('client', id, title)"
            @add="openNew('client')"
            @deleted="(id) => onListDeleted('client', id)"
          />
          <ContactList
            v-else-if="tab.comp === 'contact-list'"
            :refresh-tick="refreshTick"
            @open="(id, title) => openDetail('contact', id, title)"
            @add="openNew('contact')"
            @deleted="(id) => onListDeleted('contact', id)"
          />
          <ProjectList
            v-else-if="tab.comp === 'project-list'"
            :refresh-tick="refreshTick"
            @open="(id, title) => openDetail('project', id, title)"
            @add="openNew('project')"
            @deleted="(id) => onListDeleted('project', id)"
          />
          <DocList v-else-if="tab.comp === 'doc-list'" :refresh-tick="refreshTick" />
          <ClientEditor
            v-else-if="tab.comp === 'client'"
            :ref-id="tab.refId!"
            :refresh-tick="refreshTick"
            @rename="(title) => onRenamed(tab, title)"
            @removed="onRemoved(tab)"
            @open-contact="(id, title) => openDetail('contact', id, title)"
            @open-project="(id, title) => openDetail('project', id, title)"
            @add-contact="openNew('contact', tab.refId)"
            @add-project="openNew('project', tab.refId)"
          />
          <ContactEditor
            v-else-if="tab.comp === 'contact'"
            :ref-id="tab.refId!"
            @rename="(title) => onRenamed(tab, title)"
            @removed="onRemoved(tab)"
          />
          <ProjectEditor
            v-else-if="tab.comp === 'project'"
            :ref-id="tab.refId!"
            @rename="(title) => onRenamed(tab, title)"
            @removed="onRemoved(tab)"
          />
          <CrmNewForm
            v-else
            :entity="tab.entity!"
            :preset-client-id="tab.presetClientId"
            @created="(id, title) => onCreated(tab, id, title)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.crm-panel {
  display: grid;
  grid-template-columns: 140px 1fr;
  height: 100%;

  .crm-nav {
    border-right: 1px solid var(--border);
    background: var(--bg-soft);
    padding-top: 8px;
    overflow-y: auto;

    .nav-item {
      display: block;
      width: 100%;
      padding: 6px 14px;
      border: 0;
      background: none;
      color: var(--fg);
      text-align: left;
      cursor: pointer;

      &:hover { background: var(--bg-hover); }
      &.active { background: var(--bg-hover); color: var(--accent); }

      .icon { display: inline-block; width: 22px; }
    }
  }

  .crm-main {
    display: flex;
    flex-direction: column;
    min-width: 0;

    // 内层 tab 比外层轻量一号，视觉上区分两层
    .inner-tabs :deep(.tab) {
      font-size: 12px;
      padding: 3px 6px 3px 10px;
    }

    .crm-body {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .pane {
      height: 100%;
      overflow: hidden;
    }

    .welcome {
      display: grid;
      place-items: center;
      height: 100%;
      color: var(--fg-dim);
    }
  }
}
</style>
