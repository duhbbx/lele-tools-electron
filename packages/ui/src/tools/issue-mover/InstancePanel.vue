<script setup lang="ts">
import { ref } from 'vue'
import IssueBrowser from './IssueBrowser.vue'
import RepoConfig from './RepoConfig.vue'

const props = defineProps<{ instanceId: number }>()

type View = 'browse' | 'config'
const view = ref<View>('browse')
/** 仓库配置变化后 +1，让浏览区重新拉取仓库/issue 列表 */
const reloadTick = ref(0)
</script>

<template>
  <div class="im-panel">
    <nav class="im-subtabs">
      <button :class="{ active: view === 'browse' }" @click="view = 'browse'">📋 浏览 / 搬运</button>
      <button :class="{ active: view === 'config' }" @click="view = 'config'">⚙️ 仓库配置</button>
    </nav>
    <div class="im-panel-body">
      <IssueBrowser
        v-show="view === 'browse'"
        :instance-id="props.instanceId"
        :reload-tick="reloadTick"
        @go-config="view = 'config'"
      />
      <RepoConfig
        v-if="view === 'config'"
        :instance-id="props.instanceId"
        @changed="reloadTick++"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.im-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.im-subtabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px 0;
  border-bottom: 1px solid var(--border);

  button {
    border: 0;
    background: none;
    color: var(--fg-dim);
    padding: 6px 12px;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    &:hover { color: var(--fg); }
    &.active { color: var(--accent); border-bottom-color: var(--accent); }
  }
}
.im-panel-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
