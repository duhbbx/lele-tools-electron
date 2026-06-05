<script setup lang="ts">
import { ref } from 'vue'
import { locale, t } from '../i18n'
import { toolById } from '../tools'

defineProps<{ tabs: string[]; active: string | null }>()
const emit = defineEmits<{ activate: [id: string]; close: [id: string]; reorder: [fromId: string, toId: string] }>()

const draggingId = ref<string | null>(null)

function onDragStart(e: DragEvent, id: string): void {
  draggingId.value = id
  e.dataTransfer!.effectAllowed = 'move'
}

function onDrop(e: DragEvent, toId: string): void {
  e.preventDefault()
  if (draggingId.value && draggingId.value !== toId) {
    emit('reorder', draggingId.value, toId)
  }
  draggingId.value = null
}

function onDragEnd(): void {
  draggingId.value = null
}
</script>

<template>
  <div class="tool-tabs">
    <div
      v-for="id in tabs"
      :key="id"
      class="tab"
      :class="{ active: id === active, dragging: id === draggingId }"
      draggable="true"
      @click="emit('activate', id)"
      @auxclick.middle="emit('close', id)"
      @dragstart="onDragStart($event, id)"
      @dragover.prevent
      @drop="onDrop($event, id)"
      @dragend="onDragEnd"
    >
      <span>{{ toolById(id)?.icon }} {{ toolById(id)?.name[locale] ?? id }}</span>
      <button class="x" :title="t('tabs.close')" @click.stop="emit('close', id)">×</button>
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
