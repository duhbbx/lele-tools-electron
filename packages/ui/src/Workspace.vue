<script setup lang="ts">
import { type Component, computed, onMounted, ref, shallowRef } from 'vue'
import { locale, t } from './i18n'
import { toolById } from './tools/index'
import AiChatPanel from './components/AiChatPanel.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import SideNav from './components/SideNav.vue'
import ToolTabs from './components/ToolTabs.vue'
import ContactEditor from './components/crm/ContactEditor.vue'
import ProjectEditor from './components/crm/ProjectEditor.vue'

export interface TabDesc {
  /** Unique key: tool:<toolId> | crm-contact:<id> | crm-project:<id> */
  key: string
  kind: 'tool' | 'crm-contact' | 'crm-project'
  /** toolId for tool tabs; numeric id (as string) for crm tabs */
  refId: string
  /** Display name for crm tabs; tool tabs use registry name */
  title?: string
}

const tabs = ref<TabDesc[]>([])
const active = ref<string | null>(null)
/** key → loaded component (filled after async load) */
const comps = shallowRef<Record<string, Component>>({})
const navRef = ref<InstanceType<typeof SideNav> | null>(null)
const showSettings = ref(false)
const showAi = ref(false)

onMounted(() => {
  window.api?.menu?.onOpenSettings?.(() => {
    showSettings.value = true
  })
})

// ToolContext: only when active tab is a tool tab
const toolContext = computed(() => {
  const tab = active.value ? tabs.value.find((t) => t.key === active.value) : null
  if (!tab || tab.kind !== 'tool') return undefined
  const meta = toolById(tab.refId)
  return meta ? `User is on tool "${meta.name.en} / ${meta.name.zh}"` : undefined
})

// Display array consumed by ToolTabs
const tabDisplay = computed(() =>
  tabs.value.map((tab) => {
    if (tab.kind === 'tool') {
      const meta = toolById(tab.refId)
      return {
        key: tab.key,
        title: meta?.name[locale.value] ?? tab.refId,
        icon: meta?.icon ?? '',
      }
    }
    if (tab.kind === 'crm-contact') {
      return { key: tab.key, title: tab.title ?? tab.refId, icon: '👤' }
    }
    // crm-project
    return { key: tab.key, title: tab.title ?? tab.refId, icon: '📁' }
  }),
)

function resolveComp(tab: TabDesc): Component | undefined {
  if (tab.kind === 'tool') return comps.value[tab.key]
  if (tab.kind === 'crm-contact') return ContactEditor
  return ProjectEditor
}

async function openTool(toolId: string): Promise<void> {
  const meta = toolById(toolId)
  if (!meta) return
  const key = `tool:${toolId}`
  if (!comps.value[key]) {
    const mod = await meta.load()
    comps.value = { ...comps.value, [key]: mod.default }
  }
  if (!tabs.value.find((t) => t.key === key)) {
    tabs.value = [...tabs.value, { key, kind: 'tool', refId: toolId }]
  }
  active.value = key
  void window.api?.recents?.touch?.(toolId)
}

function openCrm(kind: 'crm-contact' | 'crm-project', refId: number, title: string): void {
  const key = `${kind}:${refId}`
  const existing = tabs.value.find((t) => t.key === key)
  if (existing) {
    existing.title = title
    active.value = key
    return
  }
  tabs.value = [...tabs.value, { key, kind, refId: String(refId), title }]
  active.value = key
}

function close(key: string): void {
  tabs.value = tabs.value.filter((t) => t.key !== key)
  if (active.value === key) active.value = tabs.value[tabs.value.length - 1]?.key ?? null
}

function reorder(fromKey: string, toKey: string): void {
  const arr = [...tabs.value]
  const fromIdx = arr.findIndex((t) => t.key === fromKey)
  const toIdx = arr.findIndex((t) => t.key === toKey)
  if (fromIdx === -1 || toIdx === -1) return
  const [item] = arr.splice(fromIdx, 1)
  arr.splice(toIdx, 0, item!)
  tabs.value = arr
}

function onTabRename(tab: TabDesc, newTitle: string): void {
  tab.title = newTitle
  navRef.value?.refreshCrm?.()
}

function onTabRemoved(tab: TabDesc): void {
  close(tab.key)
  navRef.value?.refreshCrm?.()
}

defineExpose({ openCrm })
</script>

<template>
  <div class="workspace" :class="{ 'with-ai': showAi }">
    <SideNav ref="navRef" @open="openTool" @open-crm="openCrm" />
    <div class="main">
      <div class="tabbar-row">
        <ToolTabs class="grow" :tabs="tabDisplay" :active="active" @activate="active = $event" @close="close" @reorder="reorder" />
        <button class="btn ai-toggle" @click="showAi = !showAi">🤖</button>
      </div>
      <div class="body">
        <div v-if="!tabs.length" class="welcome">{{ t('welcome.hint') }}</div>
        <div v-for="tab in tabs" v-show="tab.key === active" :key="tab.key" class="pane">
          <component
            :is="resolveComp(tab)"
            v-bind="tab.kind === 'tool' ? {} : { refId: Number(tab.refId) }"
            @rename="onTabRename(tab, $event)"
            @removed="onTabRemoved(tab)"
          />
        </div>
      </div>
    </div>
    <AiChatPanel v-if="showAi" :tool-context="toolContext" @close="showAi = false" />
    <SettingsDialog :open="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped lang="scss">
.workspace {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  &.with-ai { grid-template-columns: 240px 1fr 340px; }
  .main { display: flex; flex-direction: column; min-width: 0; }
  .tabbar-row { display: flex; align-items: stretch; .grow { flex: 1; min-width: 0; } .ai-toggle { margin: 6px 8px 0; } }
  .body { flex: 1; min-height: 0; overflow: hidden; position: relative; }
  .pane { height: 100%; overflow: hidden; }
  .welcome {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--fg-dim);
  }
}
</style>
