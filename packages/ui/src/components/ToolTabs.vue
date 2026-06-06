<script setup lang="ts">
import { ref } from 'vue'
import { t } from '../i18n'

defineProps<{ tabs: { key: string; title: string; icon: string }[]; active: string | null }>()
const emit = defineEmits<{ activate: [key: string]; close: [key: string]; reorder: [fromKey: string, toKey: string] }>()

const draggingKey = ref<string | null>(null)

function onDragStart(e: DragEvent, key: string): void {
  draggingKey.value = key
  e.dataTransfer!.effectAllowed = 'move'
}

function onDrop(e: DragEvent, toKey: string): void {
  e.preventDefault()
  if (draggingKey.value && draggingKey.value !== toKey) {
    emit('reorder', draggingKey.value, toKey)
  }
  draggingKey.value = null
}

function onDragEnd(): void {
  draggingKey.value = null
}
</script>

<template>
  <div class="tool-tabs">
    <div
      v-for="tab in tabs"
      :key="tab.key"
      class="tab"
      :class="{ active: tab.key === active, dragging: tab.key === draggingKey }"
      draggable="true"
      @click="emit('activate', tab.key)"
      @auxclick.middle="emit('close', tab.key)"
      @dragstart="onDragStart($event, tab.key)"
      @dragover.prevent
      @drop="onDrop($event, tab.key)"
      @dragend="onDragEnd"
    >
      <span>{{ tab.icon }} {{ tab.title }}</span>
      <button class="x" :title="t('tabs.close')" @click.stop="emit('close', tab.key)">×</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tool-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 8px 0;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px 5px 12px;
    border: 1px solid var(--border);
    border-bottom: 0;
    border-radius: 8px 8px 0 0;
    background: var(--bg);
    cursor: pointer;
    white-space: nowrap;
    &.active { background: var(--bg-soft); border-color: var(--accent); }
    &.dragging { opacity: 0.4; }
    .x {
      border: 0;
      background: none;
      color: var(--fg-dim);
      cursor: pointer;
      font-size: 14px;
      &:hover { color: var(--danger); }
    }
  }
}
</style>
