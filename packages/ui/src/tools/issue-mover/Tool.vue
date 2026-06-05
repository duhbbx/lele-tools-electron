<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import type { GithubIssuePreview, GithubRepoInfo } from '@lele/shared-types'

// ---------- state ----------
const urlInput = ref('')
const busy = ref(false)
const fetchError = ref('')

interface PreviewEntry {
  preview: GithubIssuePreview
  checked: boolean
  result?: { url: string; number: number }
  createError?: string
}

const entries = ref<PreviewEntry[]>([])
const repos = ref<GithubRepoInfo[]>([])
const selectedRepo = ref('')
const reposError = ref('')
const summary = ref('')

// ---------- computed ----------
const checkedEntries = computed(() =>
  entries.value.filter((e) => e.checked && !e.preview.error),
)

const canMove = computed(
  () =>
    !busy.value &&
    selectedRepo.value !== '' &&
    checkedEntries.value.length > 0,
)

// ---------- methods ----------
async function loadRepos(): Promise<void> {
  reposError.value = ''
  try {
    repos.value = await window.api.github.listOwnRepos()
    if (repos.value.length > 0 && !selectedRepo.value) {
      selectedRepo.value = repos.value[0].fullName
    }
  } catch (e) {
    reposError.value = e instanceof Error ? e.message : String(e)
  }
}

async function fetchIssues(): Promise<void> {
  const lines = urlInput.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return
  busy.value = true
  fetchError.value = ''
  entries.value = []
  summary.value = ''
  try {
    for (const url of lines) {
      const preview = await window.api.github.fetchIssue(url)
      entries.value.push({ preview, checked: !preview.error })
    }
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function moveIssues(): Promise<void> {
  if (!canMove.value) return
  busy.value = true
  summary.value = ''
  let ok = 0
  let fail = 0
  for (const entry of checkedEntries.value) {
    entry.result = undefined
    entry.createError = undefined
  }
  for (const entry of checkedEntries.value) {
    const { preview } = entry
    const footer = `\n\n---\n> 搬运自: ${preview.url}`
    const body = preview.body ? preview.body + footer : footer.trimStart()
    try {
      const res = await window.api.github.createIssue(
        selectedRepo.value,
        preview.title,
        body,
      )
      entry.result = res
      ok++
    } catch (e) {
      entry.createError = e instanceof Error ? e.message : String(e)
      fail++
    }
  }
  summary.value = `完成：成功 ${ok} / 失败 ${fail}`
  busy.value = false
}

onMounted(loadRepos)
</script>

<template>
  <div class="tool-page">
    <!-- URL 输入区 -->
    <textarea
      v-model="urlInput"
      class="textarea"
      rows="5"
      :disabled="busy"
      placeholder="每行一个 GitHub Issue URL，例如：&#10;https://github.com/facebook/react/issues/123"
    />
    <div class="row">
      <button class="btn primary" :disabled="busy || !urlInput.trim()" @click="fetchIssues">
        {{ busy ? '抓取中…' : '抓取' }}
      </button>
      <span v-if="fetchError" class="error">{{ fetchError }}</span>
    </div>

    <!-- 抓取结果列表 -->
    <template v-if="entries.length">
      <div
        v-for="(entry, i) in entries"
        :key="i"
        class="row"
        style="align-items: flex-start; gap: 8px"
      >
        <input
          type="checkbox"
          :checked="entry.checked"
          :disabled="!!entry.preview.error || busy"
          style="margin-top: 3px; flex-shrink: 0"
          @change="entry.checked = ($event.target as HTMLInputElement).checked"
        />
        <div style="flex: 1; min-width: 0">
          <div v-if="entry.preview.error" class="error">
            {{ entry.preview.url }} — {{ entry.preview.error }}
          </div>
          <template v-else>
            <span style="font-weight: 500">{{ entry.preview.title }}</span>
            <span class="hint" style="margin-left: 8px">
              {{ entry.preview.owner }}/{{ entry.preview.repo }}#{{ entry.preview.number }}
            </span>
            <span v-if="entry.result" style="margin-left: 8px; color: var(--color-success, #22c55e)">
              ✅
              <a :href="entry.result.url" target="_blank" rel="noopener">#{{ entry.result.number }}</a>
            </span>
            <span v-else-if="entry.createError" class="error" style="margin-left: 8px">
              ❌ {{ entry.createError }}
            </span>
          </template>
        </div>
      </div>
    </template>

    <!-- 目标仓库行 -->
    <div class="row">
      <label style="flex-shrink: 0">目标仓库</label>
      <select v-model="selectedRepo" class="select" :disabled="busy || !repos.length" style="flex: 1; min-width: 0">
        <option v-if="!repos.length" value="">（加载中…）</option>
        <option
          v-for="r in repos"
          :key="r.fullName"
          :value="r.fullName"
        >
          {{ r.fullName }}{{ r.private ? ' 🔒' : '' }}
        </option>
      </select>
      <button class="btn" :disabled="busy" @click="loadRepos">刷新</button>
      <span v-if="reposError" class="error">{{ reposError }}</span>
    </div>

    <!-- 搬运按钮 -->
    <div class="row">
      <button class="btn primary" :disabled="!canMove" @click="moveIssues">
        搬运 {{ checkedEntries.length }} 条
      </button>
      <span v-if="summary" class="hint">{{ summary }}</span>
    </div>
  </div>
</template>
