<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ImInstance } from '@lele/shared-types'
import InstancePanel from './InstancePanel.vue'

const instances = ref<ImInstance[]>([])
const activeId = ref<number | null>(null)
const error = ref('')
/** 正在重命名的实例 id（Electron 渲染层不支持 window.prompt，改内联输入） */
const editingId = ref<number | null>(null)
const draft = ref('')

async function load(keep?: number): Promise<void> {
  error.value = ''
  try {
    instances.value = await window.api.issueMover.instances.list()
    if (keep != null && instances.value.some((i) => i.id === keep)) activeId.value = keep
    else if (activeId.value == null && instances.value.length) activeId.value = instances.value[0].id
    else if (activeId.value != null && !instances.value.some((i) => i.id === activeId.value))
      activeId.value = instances.value[0]?.id ?? null
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function createInstance(): Promise<void> {
  const id = await window.api.issueMover.instances.create('新搬运配置')
  await load(id)
  activeId.value = id
  startEdit({ id, name: '新搬运配置' } as ImInstance)
}

function startEdit(inst: ImInstance): void {
  editingId.value = inst.id
  draft.value = inst.name
}

async function commitEdit(inst: ImInstance): Promise<void> {
  if (editingId.value !== inst.id) return
  editingId.value = null
  const name = draft.value.trim() || '未命名'
  if (name === inst.name) return
  await window.api.issueMover.instances.rename(inst.id, name)
  await load(inst.id)
}

async function removeInstance(inst: ImInstance): Promise<void> {
  if (!window.confirm(`删除「${inst.name}」？源/目标仓库与已拉取的 issue 记录会一并删除。`)) return
  await window.api.issueMover.instances.remove(inst.id)
  if (activeId.value === inst.id) activeId.value = null
  await load()
}

onMounted(() => load())
</script>

<template>
  <div class="im-root">
    <aside class="im-side">
      <div class="im-side-head">
        <span>搬运配置</span>
        <button class="btn primary sm" @click="createInstance">＋ 新建</button>
      </div>
      <p v-if="error" class="error" style="padding: 0 10px">{{ error }}</p>
      <ul class="im-list">
        <li
          v-for="inst in instances"
          :key="inst.id"
          class="im-item"
          :class="{ active: inst.id === activeId }"
          @click="activeId = inst.id"
          @dblclick="startEdit(inst)"
        >
          <input
            v-if="editingId === inst.id"
            v-model="draft"
            class="input name-edit"
            :ref="(el) => el && (el as HTMLInputElement).focus()"
            @click.stop
            @keyup.enter="commitEdit(inst)"
            @keyup.esc="editingId = null"
            @blur="commitEdit(inst)"
          />
          <span v-else class="name">{{ inst.name }}</span>
          <span class="ops">
            <button title="重命名" @click.stop="startEdit(inst)">✏️</button>
            <button title="删除" @click.stop="removeInstance(inst)">🗑️</button>
          </span>
        </li>
      </ul>
      <p v-if="!instances.length" class="hint" style="padding: 8px 12px">
        还没有搬运配置，点「新建」创建一个。
      </p>
    </aside>
    <main class="im-content">
      <InstancePanel v-if="activeId != null" :key="activeId" :instance-id="activeId" />
      <div v-else class="im-empty">选择或新建一个搬运配置</div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.im-root {
  display: grid;
  grid-template-columns: 200px 1fr;
  height: 100%;
  min-height: 0;
}
.im-side {
  border-right: 1px solid var(--border);
  background: var(--bg-soft);
  display: flex;
  flex-direction: column;
  overflow-y: auto;

  .im-side-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    font-weight: 600;
  }
  .btn.sm { padding: 2px 8px; font-size: 12px; }
}
.im-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.im-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  &:hover { background: var(--bg-hover); }
  &.active { background: var(--bg-hover); color: var(--accent); }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name-edit { flex: 1; min-width: 0; padding: 2px 6px; font-size: 13px; }
  .ops button {
    border: 0;
    background: none;
    cursor: pointer;
    opacity: 0;
    font-size: 12px;
  }
  &:hover .ops button { opacity: 0.7; }
}
.im-content {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.im-empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--fg-dim);
}
</style>
