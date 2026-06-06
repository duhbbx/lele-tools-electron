<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NoteFolder, NoteListItem } from '@lele/shared-types'
import { t } from '../../i18n'

const props = defineProps<{ selectedId: number | null }>()
const emit = defineEmits<{ select: [id: number]; removed: [id: number] }>()

// ── state ──────────────────────────────────────────────────────────────────
const folders = ref<NoteFolder[]>([])
const notes = ref<NoteListItem[]>([])
const expanded = ref(new Set<number>())

// 内联新建文件夹：false=没在加；number|null=在该文件夹（null=根）下加
const addingFolderIn = ref<number | null | false>(false)
const newFolderName = ref('')

// 重命名
const renamingId = ref<number | null>(null)
const renameText = ref('')

// 两步删除确认 key = `folder:${id}` | `note:${id}`
const pendingDelete = ref<string | null>(null)
const deleteTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ── data ───────────────────────────────────────────────────────────────────
async function refresh(): Promise<void> {
  try {
    folders.value = (await window.api?.notes?.folders?.list?.()) ?? []
    notes.value = (await window.api?.notes?.list?.()) ?? []
  } catch (e) {
    console.warn('[NotesTree] refresh error', e)
  }
}
void refresh()
defineExpose({ refresh })

// ── 扁平化渲染行 ─────────────────────────────────────────────────────────────
interface Row {
  kind: 'folder' | 'note'
  id: number
  depth: number
  label: string
  open?: boolean
}

const rows = computed<Row[]>(() => {
  const byParent = new Map<number | null, NoteFolder[]>()
  for (const f of folders.value) {
    const list = byParent.get(f.parentId) ?? []
    list.push(f)
    byParent.set(f.parentId, list)
  }
  const noteByFolder = new Map<number | null, NoteListItem[]>()
  for (const n of notes.value) {
    const list = noteByFolder.get(n.folderId) ?? []
    list.push(n)
    noteByFolder.set(n.folderId, list)
  }
  const out: Row[] = []
  const walk = (parentId: number | null, depth: number): void => {
    const fs = (byParent.get(parentId) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
    for (const f of fs) {
      const open = expanded.value.has(f.id)
      out.push({ kind: 'folder', id: f.id, depth, label: f.name, open })
      if (open) walk(f.id, depth + 1)
    }
    const ns = (noteByFolder.get(parentId) ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt)
    for (const n of ns) {
      out.push({ kind: 'note', id: n.id, depth, label: n.title })
    }
  }
  walk(null, 0)
  return out
})

function toggleExpand(id: number): void {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

// ── 新建 ─────────────────────────────────────────────────────────────────────
function startAddFolder(parentId: number | null): void {
  addingFolderIn.value = parentId
  newFolderName.value = ''
  if (parentId !== null) expanded.value = new Set(expanded.value).add(parentId)
}

async function confirmAddFolder(): Promise<void> {
  const name = newFolderName.value.trim()
  if (!name || addingFolderIn.value === false) return
  await window.api?.notes?.folders?.create?.(addingFolderIn.value, name)
  addingFolderIn.value = false
  await refresh()
}

async function addNote(folderId: number | null): Promise<void> {
  const id = await window.api?.notes?.create?.(folderId)
  if (folderId !== null) expanded.value = new Set(expanded.value).add(folderId)
  await refresh()
  if (id) emit('select', id)
}

// ── 重命名（双击文件夹） ──────────────────────────────────────────────────────
function startRename(row: Row): void {
  if (row.kind !== 'folder') return
  renamingId.value = row.id
  renameText.value = row.label
}

async function confirmRename(): Promise<void> {
  if (renamingId.value === null) return // Esc 后的 blur 直接退出
  const name = renameText.value.trim()
  if (name) {
    await window.api?.notes?.folders?.rename?.(renamingId.value, name)
  }
  renamingId.value = null
  await refresh()
}

// ── 两步删除确认（CRM 同款） ──────────────────────────────────────────────────
function startDelete(key: string): void {
  if (pendingDelete.value && pendingDelete.value !== key) {
    clearTimer(pendingDelete.value)
    pendingDelete.value = null
  }
  if (pendingDelete.value === key) {
    void executeDelete(key)
    return
  }
  pendingDelete.value = key
  const timer = setTimeout(() => {
    if (pendingDelete.value === key) pendingDelete.value = null
    deleteTimers.delete(key)
  }, 3000)
  deleteTimers.set(key, timer)
}

function clearTimer(key: string): void {
  const timer = deleteTimers.get(key)
  if (timer !== undefined) {
    clearTimeout(timer)
    deleteTimers.delete(key)
  }
}

async function executeDelete(key: string): Promise<void> {
  clearTimer(key)
  pendingDelete.value = null
  const [kind, idStr] = key.split(':') as [string, string]
  const id = Number(idStr)
  try {
    if (kind === 'folder') {
      await window.api?.notes?.folders?.remove?.(id)
    } else {
      await window.api?.notes?.remove?.(id)
      emit('removed', id)
    }
    await refresh()
  } catch (e) {
    console.warn('[NotesTree] delete error', e)
  }
}

// ── 拖拽移动 ─────────────────────────────────────────────────────────────────
const dropTarget = ref<string | null>(null) // `folder:${id}` | 'root'

function onDragStart(e: DragEvent, row: Row): void {
  e.dataTransfer?.setData('application/x-lele-note', JSON.stringify({ kind: row.kind, id: row.id }))
}

function isDescendant(folderId: number, maybeAncestor: number): boolean {
  const parentOf = new Map(folders.value.map((f) => [f.id, f.parentId]))
  let cur: number | null = folderId
  while (cur !== null) {
    if (cur === maybeAncestor) return true
    cur = parentOf.get(cur) ?? null
  }
  return false
}

async function onDrop(e: DragEvent, targetFolderId: number | null): Promise<void> {
  dropTarget.value = null
  const raw = e.dataTransfer?.getData('application/x-lele-note')
  if (!raw) return
  let parsed: { kind: 'folder' | 'note'; id: number }
  try {
    parsed = JSON.parse(raw) as { kind: 'folder' | 'note'; id: number }
  } catch {
    return
  }
  const { kind, id } = parsed
  if (kind === 'note') {
    await window.api?.notes?.move?.(id, targetFolderId)
  } else {
    // 不能移到自己或自己的子树里
    if (targetFolderId !== null && (targetFolderId === id || isDescendant(targetFolderId, id))) return
    await window.api?.notes?.folders?.move?.(id, targetFolderId)
  }
  await refresh()
}
</script>

<template>
  <div
    class="notes-tree"
    :class="{ 'drop-root': dropTarget === 'root' }"
    @dragover.prevent="dropTarget = 'root'"
    @dragleave="dropTarget = null"
    @drop.prevent="onDrop($event, null)"
  >
    <div class="tree-header">
      <span class="tree-title">{{ t('notes.tree') }}</span>
      <button class="btn-icon" :title="t('notes.newFolder')" @click="startAddFolder(null)">📁+</button>
      <button class="btn-icon" :title="t('notes.newNote')" @click="addNote(null)">📄+</button>
    </div>

    <!-- 根级新建文件夹表单 -->
    <div v-if="addingFolderIn === null" class="inline-form">
      <input
        v-model="newFolderName"
        class="inline-input"
        :placeholder="t('notes.newFolder')"
        autofocus
        @keydown.enter="confirmAddFolder"
        @keydown.esc="addingFolderIn = false"
      />
      <button class="btn-icon" @click="confirmAddFolder">✓</button>
      <button class="btn-icon" @click="addingFolderIn = false">✕</button>
    </div>

    <template v-for="row in rows" :key="`${row.kind}:${row.id}`">
      <!-- 文件夹行 -->
      <div
        v-if="row.kind === 'folder'"
        class="tree-row"
        :class="{ 'drop-over': dropTarget === `folder:${row.id}` }"
        :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
        draggable="true"
        @click="toggleExpand(row.id)"
        @dblclick="startRename(row)"
        @dragstart="onDragStart($event, row)"
        @dragover.prevent.stop="dropTarget = `folder:${row.id}`"
        @dragleave.stop="dropTarget = null"
        @drop.prevent.stop="onDrop($event, row.id)"
      >
        <span class="arrow">{{ row.open ? '▾' : '▸' }}</span>
        <span class="row-icon">📁</span>
        <template v-if="renamingId === row.id">
          <input
            v-model="renameText"
            class="inline-input"
            autofocus
            @click.stop
            @keydown.enter="confirmRename"
            @keydown.esc="renamingId = null"
            @blur="confirmRename"
          />
        </template>
        <span v-else class="row-label">{{ row.label }}</span>
        <button class="btn-icon small" :title="t('notes.newNote')" @click.stop="addNote(row.id)">📄+</button>
        <button class="btn-icon small" :title="t('notes.newFolder')" @click.stop="startAddFolder(row.id)">📁+</button>
        <button
          class="btn-del"
          :class="{ confirming: pendingDelete === `folder:${row.id}` }"
          @click.stop="startDelete(`folder:${row.id}`)"
        >{{ pendingDelete === `folder:${row.id}` ? t('notes.confirmDelete') : '×' }}</button>
      </div>

      <!-- 该文件夹下的内联新建文件夹表单 -->
      <div
        v-if="row.kind === 'folder' && addingFolderIn === row.id"
        class="inline-form"
        :style="{ paddingLeft: `${24 + row.depth * 14}px` }"
      >
        <input
          v-model="newFolderName"
          class="inline-input"
          :placeholder="t('notes.newFolder')"
          autofocus
          @keydown.enter="confirmAddFolder"
          @keydown.esc="addingFolderIn = false"
        />
        <button class="btn-icon" @click="confirmAddFolder">✓</button>
        <button class="btn-icon" @click="addingFolderIn = false">✕</button>
      </div>

      <!-- 笔记行 -->
      <div
        v-if="row.kind === 'note'"
        class="tree-row"
        :class="{ selected: props.selectedId === row.id }"
        :style="{ paddingLeft: `${24 + row.depth * 14}px` }"
        draggable="true"
        @click="emit('select', row.id)"
        @dragstart="onDragStart($event, row)"
      >
        <span class="row-icon">📄</span>
        <span class="row-label" :class="{ dim: !row.label }">{{ row.label || t('notes.untitled') }}</span>
        <button
          class="btn-del"
          :class="{ confirming: pendingDelete === `note:${row.id}` }"
          @click.stop="startDelete(`note:${row.id}`)"
        >{{ pendingDelete === `note:${row.id}` ? t('notes.confirmDelete') : '×' }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.notes-tree {
  overflow-y: auto;
  height: 100%;
  padding-bottom: 12px;
  border-right: 1px solid var(--border);

  &.drop-root { background: color-mix(in srgb, var(--accent) 6%, transparent); }

  .tree-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 10px 4px;

    .tree-title {
      flex: 1;
      font-size: 11px;
      color: var(--fg-dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }

  .inline-form {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
  }

  .inline-input {
    flex: 1;
    min-width: 60px;
    font-size: 12px;
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--bg);
    color: var(--fg);
    outline: none;
    &:focus { border-color: var(--accent); }
  }

  .tree-row {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px 4px 10px;
    cursor: pointer;
    user-select: none;

    &:hover {
      background: var(--bg-hover);
      .btn-del, .btn-icon.small { opacity: 1; }
    }

    &.selected { background: color-mix(in srgb, var(--accent) 16%, transparent); }
    &.drop-over { outline: 1px dashed var(--accent); outline-offset: -1px; }

    .arrow { font-size: 10px; color: var(--fg-dim); width: 13px; flex-shrink: 0; }
    .row-icon { font-size: 13px; width: 18px; flex-shrink: 0; text-align: center; }

    .row-label {
      flex: 1;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      &.dim { color: var(--fg-dim); }
    }
  }

  .btn-icon {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--fg-dim);
    font-size: 11px;
    padding: 1px 3px;
    border-radius: 3px;
    line-height: 1;
    flex-shrink: 0;

    &:hover { background: var(--bg-hover); color: var(--fg); }
    &.small { opacity: 0; }
  }

  .btn-del {
    opacity: 0;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--fg-dim);
    font-size: 13px;
    padding: 0 4px;
    border-radius: 3px;
    flex-shrink: 0;

    &:hover { color: var(--danger); }

    &.confirming {
      opacity: 1;
      color: var(--danger);
      font-size: 11px;
      background: color-mix(in srgb, var(--danger) 12%, transparent);
      padding: 1px 5px;
    }
  }
}
</style>
