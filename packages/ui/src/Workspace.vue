<script setup lang="ts">
import { type Component, ref, shallowRef } from 'vue'
import { t } from './i18n'
import { toolById } from './tools'
import SideNav from './components/SideNav.vue'
import ToolTabs from './components/ToolTabs.vue'
import SettingsDialog from './components/SettingsDialog.vue'

const tabs = ref<string[]>([])
const active = ref<string | null>(null)
/** toolId → 已加载的组件（异步 load 完成后填充） */
const comps = shallowRef<Record<string, Component>>({})
const navRef = ref<InstanceType<typeof SideNav>>()
const showSettings = ref(false)

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
</script>

<template>
  <div class="workspace">
    <SideNav ref="navRef" @open="open" @settings="showSettings = true" />
    <div class="main">
      <ToolTabs :tabs="tabs" :active="active" @activate="active = $event" @close="close" />
      <div class="body">
        <div v-if="!tabs.length" class="welcome">{{ t('welcome.hint') }}</div>
        <div v-for="id in tabs" v-show="id === active" :key="id" class="pane">
          <component :is="comps[id]" />
        </div>
      </div>
    </div>
    <SettingsDialog :open="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped lang="scss">
.workspace {
  display: grid;
  grid-template-columns: 240px 1fr;
  height: 100%;
  .main { display: flex; flex-direction: column; min-width: 0; }
  .body { flex: 1; min-height: 0; position: relative; }
  .pane { height: 100%; }
  .welcome {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--fg-dim);
  }
}
</style>
