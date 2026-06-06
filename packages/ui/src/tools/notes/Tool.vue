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
const previewRef = ref<InstanceType<typeof NotePreview>>()

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

onBeforeUnmount(() => {
  if (syncResetTimer) clearTimeout(syncResetTimer)
  void flush()
})

// ── 滚动联动：百分比同步 + 来源锁防回环 ──────────────────────────────────────
let syncSource: 'edit' | 'preview' | null = null
let syncResetTimer: ReturnType<typeof setTimeout> | null = null

function syncFrom(source: 'edit' | 'preview', ratio: number): void {
  if (!showEdit.value || !showPreview.value) return // 单栏时不联动
  if (syncSource && syncSource !== source) return
  syncSource = source
  if (source === 'edit') previewRef.value?.setScrollRatio(ratio)
  else editorRef.value?.setScrollRatio(ratio)
  if (syncResetTimer) clearTimeout(syncResetTimer)
  syncResetTimer = setTimeout(() => {
    syncSource = null
  }, 150)
}

// ── PDF 导出 ─────────────────────────────────────────────────────────────────
const showExport = ref(false)
const watermarkOn = ref(localStorage.getItem('notes.watermarkOn') === '1')
const watermarkText = ref(localStorage.getItem('notes.watermarkText') ?? '')
const exportMsg = ref('')

let exporting = false

async function doExport(): Promise<void> {
  if (!note.value || exporting) return
  exporting = true
  try {
    showExport.value = false
    localStorage.setItem('notes.watermarkOn', watermarkOn.value ? '1' : '0')
    localStorage.setItem('notes.watermarkText', watermarkText.value)
    await flush()
    if (!note.value) return
    const html = previewRef.value?.getHtml() ?? ''
    const wm = watermarkOn.value ? watermarkText.value.trim() : ''
    const path = await window.api?.notes?.exportPdf?.(note.value.title || t('notes.untitled'), html, wm)
    if (path) {
      exportMsg.value = t('notes.exported')
      setTimeout(() => {
        exportMsg.value = ''
      }, 3000)
    }
  } finally {
    exporting = false
  }
}
</script>

<template>
  <div class="tool-page notes-tool">
    <div class="row">
      <button class="btn" :class="{ primary: showTree }" :title="t('notes.tree')" @click="showTree = !showTree">🗂</button>
      <button class="btn" :disabled="!note || !showEdit" @click="insertAttachment('image')">{{ t('notes.insertImage') }}</button>
      <button class="btn" :disabled="!note || !showEdit" @click="insertAttachment('file')">{{ t('notes.insertFile') }}</button>
      <span class="export-wrap">
        <button class="btn" :disabled="!note" @click="showExport = !showExport">{{ t('notes.exportPdf') }}</button>
        <div v-if="showExport" class="export-pop">
          <label class="wm-row"><input v-model="watermarkOn" type="checkbox" /> {{ t('notes.watermark') }}</label>
          <input
            v-if="watermarkOn"
            v-model="watermarkText"
            class="wm-input"
            :placeholder="t('notes.watermarkText')"
            @keydown.enter="doExport"
          />
          <div class="wm-actions">
            <button class="btn primary" @click="doExport">{{ t('notes.export') }}</button>
            <button class="btn" @click="showExport = false">{{ t('notes.cancel') }}</button>
          </div>
        </div>
      </span>
      <span class="grow" />
      <span class="save-state">{{ exportMsg || (saveState === 'saving' ? t('notes.saving') : saveState === 'saved' ? t('notes.saved') : '') }}</span>
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
          @scroll="syncFrom('edit', $event)"
        />
        <NotePreview
          v-show="showPreview"
          ref="previewRef"
          :content="content"
          class="pane preview"
          @scroll="syncFrom('preview', $event)"
        />
      </template>
      <div v-else class="empty">{{ t('notes.empty') }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.notes-tool {
  .export-wrap { position: relative; }
  .export-pop {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 10;
    background: var(--bg-soft); border: 1px solid var(--border); border-radius: 6px;
    padding: 10px; display: flex; flex-direction: column; gap: 8px; min-width: 200px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    .wm-row { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .wm-input {
      font-size: 12px; padding: 3px 6px; border: 1px solid var(--border); border-radius: 4px;
      background: var(--bg); color: var(--fg); outline: none;
      &:focus { border-color: var(--accent); }
    }
    .wm-actions { display: flex; gap: 6px; justify-content: flex-end; }
  }

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
