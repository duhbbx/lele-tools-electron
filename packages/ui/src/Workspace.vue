<script setup lang="ts">
import { type Component, computed, ref, shallowRef } from 'vue'
import { t } from './i18n'
import { toolById } from './tools'
import AiChatPanel from './components/AiChatPanel.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import SideNav from './components/SideNav.vue'
import ToolTabs from './components/ToolTabs.vue'

const tabs = ref<string[]>([])
const active = ref<string | null>(null)
/** toolId → 已加载的组件（异步 load 完成后填充） */
const comps = shallowRef<Record<string, Component>>({})
const navRef = ref<InstanceType<typeof SideNav>>()
const showSettings = ref(false)
const showAi = ref(false)

const toolContext = computed(() => {
  const meta = active.value ? toolById(active.value) : null
  return meta ? `User is on tool "${meta.name.en} / ${meta.name.zh}"` : undefined
})

async function open(id: string): Promise<void> {
  const meta = toolById(id)
  if (!meta) return
  if (!comps.value[id]) {
    const mod = await meta.load()
    comps.value = { ...comps.value, [id]: mod.default }
  }
  if (!tabs.value.includes(id)) tabs.value = [...tabs.value, id]
  active.value = id
  void window.api?.recents?.touch?.(id).then(() => navRef.value?.refreshRecents())
}

function close(id: string): void {
  tabs.value = tabs.value.filter((x) => x !== id)
  if (active.value === id) active.value = tabs.value[tabs.value.length - 1] ?? null
}

function reorder(fromId: string, toId: string): void {
  const arr = [...tabs.value]
  const fromIdx = arr.indexOf(fromId)
  const toIdx = arr.indexOf(toId)
  if (fromIdx === -1 || toIdx === -1) return
  arr.splice(fromIdx, 1)
  arr.splice(toIdx, 0, fromId)
  tabs.value = arr
}
</script>

<template>
  <div class="workspace" :class="{ 'with-ai': showAi }">
    <SideNav ref="navRef" @open="open" @settings="showSettings = true" />
    <div class="main">
      <div class="tabbar-row">
        <ToolTabs class="grow" :tabs="tabs" :active="active" @activate="active = $event" @close="close" @reorder="reorder" />
        <button class="btn ai-toggle" @click="showAi = !showAi">🤖</button>
      </div>
      <div class="body">
        <div v-if="!tabs.length" class="welcome">{{ t('welcome.hint') }}</div>
        <div v-for="id in tabs" v-show="id === active" :key="id" class="pane">
          <component :is="comps[id]" />
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
