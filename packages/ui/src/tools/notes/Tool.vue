<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { Note } from '@lele/shared-types'
import { t } from '../../i18n'
import NoteEditor from './NoteEditor.vue'
import NotePreview from './NotePreview.vue'
import NotesTree from './NotesTree.vue'
import { extractTitle } from './title'

const treeRef = ref<InstanceType<typeof NotesTree>>()
const editorRef = ref<InstanceType<typeof NoteEditor>>()

// 三栏开关：编辑/预览不允许同时关
const showTree = ref(true)
const showEdit = ref(true)
const showPreview = ref(true)

const note = ref<Note | null>(null)
const content = ref('')
const saveState = ref<'idle' | 'saving' | 'saved'>('idle')

let saveTimer: ReturnType<typeof setTimeout> | null = null
let dirty = false
let loading = false // 加载笔记时抑制 content watcher

function togglePane(pane: 'edit' | 'preview'): void {
  if (pane === 'edit') {
    if (showEdit.value && !showPreview.value) return
    showEdit.value = !showEdit.value
  } else {
    if (showPreview.value && !showEdit.value) return
    showPreview.value = !showPreview.value
  }
}

async function flush(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!dirty || !note.value) return
  dirty = false
  const title = extractTitle(content.value)
  await window.api?.notes?.update?.(note.value.id, content.value, title)
  saveState.value = 'saved'
  if (note.value && title !== note.value.title) {
    note.value.title = title
    void treeRef.value?.refresh()
  }
}

watch(content, () => {
  if (loading || !note.value) return
  dirty = true
  saveState.value = 'saving'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void flush(), 800)
})

async function openNote(id: number): Promise<void> {
  await flush()
  const n = await window.api?.notes?.get?.(id)
  if (!n) return
  loading = true
  note.value = n
  content.value = n.content
  dirty = false
  saveState.value = 'idle'
  // watch 回调在 content 赋值的同一拍同步触发，下一拍解除抑制
  requestAnimationFrame(() => {
    loading = false
  })
}

function onRemoved(id: number): void {
  if (note.value?.id === id) {
    note.value = null
    content.value = ''
    dirty = false
    saveState.value = 'idle'
  }
}

async function insertAttachment(kind: 'image' | 'file'): Promise<void> {
  if (!note.value) return
  const row = await window.api?.notes?.files?.pick?.(note.value.id, kind)
  if (row) editorRef.value?.insertFileMd(row)
}

onBeforeUnmount(() => void flush())
</script>

<template>
  <div class="tool-page notes-tool">
    <div class="row">
      <button class="btn" :class="{ primary: showTree }" :title="t('notes.tree')" @click="showTree = !showTree">🗂</button>
      <button class="btn" :disabled="!note || !showEdit" @click="insertAttachment('image')">{{ t('notes.insertImage') }}</button>
      <button class="btn" :disabled="!note || !showEdit" @click="insertAttachment('file')">{{ t('notes.insertFile') }}</button>
      <span class="grow" />
      <span class="save-state">{{ saveState === 'saving' ? t('notes.saving') : saveState === 'saved' ? t('notes.saved') : '' }}</span>
      <button class="btn" :class="{ primary: showEdit }" @click="togglePane('edit')">{{ t('notes.editPane') }}</button>
      <button class="btn" :class="{ primary: showPreview }" @click="togglePane('preview')">{{ t('notes.previewPane') }}</button>
    </div>

    <div class="panes">
      <NotesTree
        v-show="showTree"
        ref="treeRef"
        class="tree"
        :selected-id="note?.id ?? null"
        @select="openNote"
        @removed="onRemoved"
      />
      <template v-if="note">
        <NoteEditor
          v-show="showEdit"
          ref="editorRef"
          v-model="content"
          :note-id="note.id"
          class="pane"
        />
        <NotePreview v-show="showPreview" :content="content" class="pane preview" />
      </template>
      <div v-else class="empty">{{ t('notes.empty') }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.notes-tool {
  .save-state {
    font-size: 12px;
    color: var(--fg-dim);
    min-width: 64px;
    text-align: right;
  }

  .panes {
    flex: 1;
    display: flex;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-soft);

    .tree { width: 220px; flex-shrink: 0; }

    .pane {
      flex: 1;
      min-width: 0;
      &.preview { border-left: 1px solid var(--border); }
    }

    .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--fg-dim);
      font-size: 13px;
    }
  }
}
</style>
