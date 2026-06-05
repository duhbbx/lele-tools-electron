<script setup lang="ts">
import { locale, t } from '../i18n'
import { toolById } from '../tools'

defineProps<{ tabs: string[]; active: string | null }>()
const emit = defineEmits<{ activate: [id: string]; close: [id: string] }>()
</script>

<template>
  <div class="tool-tabs">
    <div
      v-for="id in tabs"
      :key="id"
      class="tab"
      :class="{ active: id === active }"
      @click="emit('activate', id)"
      @auxclick.middle="emit('close', id)"
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
