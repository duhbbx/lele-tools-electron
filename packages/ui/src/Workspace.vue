<script setup lang="ts">
import { type Component, computed, onMounted, ref, shallowRef } from 'vue'
import { locale, t } from './i18n'
import { settings } from './settings'
import { toolById } from './tools/index'
import AiChatPanel from './components/AiChatPanel.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import SideNav from './components/SideNav.vue'
import ToolTabs from './components/ToolTabs.vue'

export interface TabDesc {
  /** Unique key: tool:<toolId> */
  key: string
  /** tool id */
  refId: string
}

const tabs = ref<TabDesc[]>([])
const active = ref<string | null>(null)
/** key → loaded component (filled after async load) */
const comps = shallowRef<Record<string, Component>>({})
const showSettings = ref(false)
const showAi = ref(false)

onMounted(() => {
  window.api?.menu?.onOpenSettings?.(() => {
    showSettings.value = true
  })
})

const toolContext = computed(() => {
  const tab = active.value ? tabs.value.find((x) => x.key === active.value) : null
  if (!tab) return undefined
  const meta = toolById(tab.refId)
  return meta ? `User is on tool "${meta.name.en} / ${meta.name.zh}"` : undefined
})

const tabDisplay = computed(() =>
  tabs.value.map((tab) => {
    const meta = toolById(tab.refId)
    return { key: tab.key, title: meta?.name[locale.value] ?? tab.refId, icon: meta?.icon ?? '' }
  }),
)

async function openTool(toolId: string): Promise<void> {
  const meta = toolById(toolId)
  if (!meta) return
  const key = `tool:${toolId}`
  if (!comps.value[key]) {
    const mod = await meta.load()
    comps.value = { ...comps.value, [key]: mod.default }
  }
  if (!tabs.value.find((x) => x.key === key)) {
    tabs.value = [...tabs.value, { key, refId: toolId }]
  }
  active.value = key
  void window.api?.recents?.touch?.(toolId)
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
  <div class="workspace" :class="{ 'with-ai': showAi, 'nav-collapsed': settings.navCollapsed }">
    <SideNav v-show="!settings.navCollapsed" @open="openTool" />
    <div class="main">
      <div class="tabbar-row">
        <button
          class="btn nav-toggle"
          :title="t(settings.navCollapsed ? 'nav.expand' : 'nav.collapse')"
          @click="settings.navCollapsed = !settings.navCollapsed"
        >{{ settings.navCollapsed ? '▶' : '◀' }}</button>
        <ToolTabs class="grow" :tabs="tabDisplay" :active="active" @activate="active = $event" @close="close" @reorder="reorder" />
        <button class="btn ai-toggle" @click="showAi = !showAi">🤖</button>
      </div>
      <div class="body">
        <div v-if="!tabs.length" class="welcome">{{ t('welcome.hint') }}</div>
        <div v-for="tab in tabs" v-show="tab.key === active" :key="tab.key" class="pane">
          <component :is="comps[tab.key]" />
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
  &.nav-collapsed { grid-template-columns: 0 1fr; }
  &.nav-collapsed.with-ai { grid-template-columns: 0 1fr 340px; }
  .main { display: flex; flex-direction: column; min-width: 0; }
  .tabbar-row { display: flex; align-items: stretch; .grow { flex: 1; min-width: 0; } .ai-toggle { margin: 6px 8px 0; } .nav-toggle { margin: 6px 0 0 8px; } }
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
