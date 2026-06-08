<script setup lang="ts">
import { marked } from 'marked'
import { computed, onMounted, ref, watch } from 'vue'
import type { ImIssue, ImRepo } from '@lele/shared-types'
import { askAiChatStream } from '../../ai'

const props = defineProps<{ instanceId: number; reloadTick: number }>()
const emit = defineEmits<{ goConfig: [] }>()

const repos = ref<ImRepo[]>([])
const issues = ref<ImIssue[]>([])
const selectedId = ref<number | null>(null)
const onlyUnmigrated = ref(false)
const error = ref('')
const pulling = ref(false)
const pullMsg = ref('')
const migrating = ref(false)
const migrateMsg = ref('')
// AI 解释
const aiText = ref('')
const aiBusy = ref(false)
const aiError = ref('')
/** 当前刚复制的目标，用于按钮反馈；'' 表示无 */
const copiedKey = ref<'' | 'ai' | 'body'>('')

/** AI 解读输出走 markdown 渲染（同 AiChatPanel：marked 直渲，内容为 AI 生成，信任模型一致） */
function renderMd(md: string): string {
  return marked.parse(md, { async: false }) as string
}

async function copy(text: string, key: 'ai' | 'body'): Promise<void> {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = ''
    }, 1500)
  } catch {
    /* 剪贴板不可用时静默 */
  }
}

const repoName = (id: number): string => {
  const r = repos.value.find((x) => x.id === id)
  return r ? `${r.owner}/${r.name}` : '?'
}
const hasTarget = computed(() => repos.value.some((r) => r.kind === 'target'))
const sourceRepos = computed(() => repos.value.filter((r) => r.kind === 'source'))

const shown = computed(() =>
  onlyUnmigrated.value ? issues.value.filter((i) => !i.migrated) : issues.value,
)
const selected = computed(() => issues.value.find((i) => i.id === selectedId.value) ?? null)
const migratedCount = computed(() => issues.value.filter((i) => i.migrated).length)

async function load(): Promise<void> {
  error.value = ''
  try {
    repos.value = await window.api.issueMover.repos.listByInstance(props.instanceId)
    issues.value = await window.api.issueMover.issues.listByInstance(props.instanceId, 'source')
    if (selectedId.value != null && !issues.value.some((i) => i.id === selectedId.value)) {
      selectedId.value = null
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function pullAll(full = false): Promise<void> {
  if (!sourceRepos.value.length) {
    error.value = '还没有源仓库，先去「仓库配置」添加。'
    return
  }
  pulling.value = true
  error.value = ''
  pullMsg.value = ''
  const errs: string[] = []
  let total = 0
  for (const r of sourceRepos.value) {
    const res = await window.api.issueMover.repos.pull(r.id, full)
    if (!res.ok) errs.push(`${r.owner}/${r.name}: ${res.error}`)
    else total += res.count ?? 0
  }
  pulling.value = false
  if (errs.length) error.value = errs.join('\n')
  pullMsg.value = `${full ? '全量' : '增量'}同步 ${total} 条`
  await load()
}

const PROMPT_HEAD =
  '下面是一个 GitHub issue，请用简洁中文 markdown 回答，固定四个小节，每节用二级标题：## 这是什么（它在讲什么、想解决或反馈什么）、## 关键点（报错信息/具体诉求，可用列表）、## 复现方法（若 issue 未给出则基于内容合理推断并标注「推断」）、## 建议方案（可行的修复或处理思路，可用列表）。'

async function explain(force = false): Promise<void> {
  const cur = selected.value
  if (!cur) return
  // 已有缓存解读且非强制重读：直接用缓存，不调 AI
  if (!force && cur.aiExplain) {
    aiText.value = cur.aiExplain
    aiError.value = ''
    return
  }
  aiBusy.value = true
  aiText.value = ''
  aiError.value = ''
  const prompt = `${PROMPT_HEAD}\n\n仓库: ${repoName(cur.repoId)}#${cur.number}\n标题: ${cur.title}\n\n正文:\n${cur.body || '(无正文)'}`
  try {
    await askAiChatStream(
      { messages: [{ role: 'user', content: prompt }], toolContext: 'Issue 搬运工具：解释源仓库的 issue' },
      (delta) => {
        aiText.value += delta
      },
    )
    // 落库缓存，并更新本地，避免重复解读
    const text = aiText.value.trim()
    if (text) {
      await window.api.issueMover.issues.setExplain(cur.id, text)
      const row = issues.value.find((i) => i.id === cur.id)
      if (row) row.aiExplain = text
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    aiError.value =
      msg === 'NO_PROVIDER' || msg === 'NO_BASE_URL' || msg === 'NO_API_KEY'
        ? '未配置 AI，请先到「设置 → AI」填好服务商 / Base URL / API Key'
        : msg
  } finally {
    aiBusy.value = false
  }
}

async function migrate(): Promise<void> {
  const cur = selected.value
  if (!cur || cur.migrated) return
  if (!hasTarget.value) {
    migrateMsg.value = '请先在「仓库配置」设置目标仓库'
    return
  }
  migrating.value = true
  migrateMsg.value = '搬运中…'
  const res = await window.api.issueMover.issues.migrate(cur.id)
  migrating.value = false
  if (res.ok) {
    migrateMsg.value = `✅ 已建 #${res.number}`
    await load()
  } else {
    migrateMsg.value = `❌ ${res.error}`
  }
}

function select(i: ImIssue): void {
  selectedId.value = i.id
  migrateMsg.value = ''
  aiError.value = ''
  // 已有缓存解读：直接展示，不再调 AI
  aiText.value = i.aiExplain || ''
}

watch(() => props.reloadTick, load)
onMounted(load)
</script>

<template>
  <div class="browser">
    <div class="toolbar">
      <button class="btn primary" :disabled="pulling" @click="pullAll(false)">
        {{ pulling ? '拉取中…' : '增量拉取' }}
      </button>
      <button class="btn" :disabled="pulling" title="忽略上次时间，重拉全部" @click="pullAll(true)">
        全量重拉
      </button>
      <label class="hint"><input v-model="onlyUnmigrated" type="checkbox" /> 只看未搬运</label>
      <span class="hint">共 {{ issues.length }} 条 · 已搬运 {{ migratedCount }}</span>
      <span v-if="pullMsg" class="hint">· {{ pullMsg }}</span>
      <span class="grow" />
      <button class="btn" @click="emit('goConfig')">⚙️ 仓库配置</button>
    </div>
    <p v-if="error" class="error" style="padding: 0 10px">{{ error }}</p>

    <div class="split">
      <ul class="issue-list">
        <li v-if="!shown.length" class="hint empty">
          {{ issues.length ? '没有符合条件的 issue' : '还没拉取 issue，点上方「增量拉取」' }}
        </li>
        <li
          v-for="i in shown"
          :key="i.id"
          class="issue-item"
          :class="{ active: i.id === selectedId, migrated: i.migrated }"
          @click="select(i)"
        >
          <div class="title">
            <span v-if="i.migrated" title="已搬运">✅</span>
            <span v-if="i.state === 'closed'" class="state-closed" title="closed">⊘</span>
            {{ i.title || '(无标题)' }}
          </div>
          <div class="meta">{{ repoName(i.repoId) }}#{{ i.number }}</div>
        </li>
      </ul>

      <div class="detail">
        <div v-if="!selected" class="empty hint">选择左侧一条 issue 查看内容</div>
        <template v-else>
          <div class="detail-head">
            <h3>{{ selected.title || '(无标题)' }}</h3>
            <div class="meta">
              <a :href="selected.htmlUrl" target="_blank" rel="noopener">
                {{ repoName(selected.repoId) }}#{{ selected.number }}
              </a>
              · {{ selected.state }}
              <span v-if="selected.migrated" class="badge">已搬运</span>
              <button class="copy-btn" style="margin-left: 8px" @click="copy(selected.body, 'body')">
                {{ copiedKey === 'body' ? '✓ 已复制' : '📋 复制正文' }}
              </button>
            </div>
          </div>
          <pre class="body">{{ selected.body || '(无正文)' }}</pre>
          <div class="actions">
            <button
              class="btn primary"
              :disabled="migrating || selected.migrated"
              @click="migrate"
            >
              {{ selected.migrated ? '已搬运' : '迁移到目标库' }}
            </button>
            <button class="btn" :disabled="aiBusy" @click="explain(false)">
              {{ aiBusy ? '🤖 解读中…' : selected.aiExplain ? '🤖 AI 解读' : '🤖 AI 解释' }}
            </button>
            <button
              v-if="selected.aiExplain"
              class="btn"
              :disabled="aiBusy"
              title="忽略缓存，重新让 AI 解读"
              @click="explain(true)"
            >
              🔄 更新解读
            </button>
            <span class="hint">{{ migrateMsg }}</span>
          </div>
          <div v-if="aiText || aiError || aiBusy" class="ai-box">
            <div class="ai-head">
              <span>🤖 AI 解读</span>
              <span v-if="selected.aiExplain && !aiBusy" class="hint">· 已缓存</span>
              <span class="grow" />
              <button v-if="aiText && !aiBusy" class="copy-btn" @click="copy(aiText, 'ai')">
                {{ copiedKey === 'ai' ? '✓ 已复制' : '📋 复制' }}
              </button>
            </div>
            <p v-if="aiError" class="error">{{ aiError }}</p>
            <template v-else>
              <!-- AI 生成内容，marked 渲染；信任模型同 AiChatPanel/NotePreview -->
              <div class="ai-text md" v-html="renderMd(aiText)" />
              <span v-if="aiBusy" class="hint">解读中…▋</span>
            </template>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  .grow { flex: 1; }
  label { display: inline-flex; align-items: center; gap: 4px; }
}
.split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px 1fr;
}
.issue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
  border-right: 1px solid var(--border);

  .empty { padding: 12px; }
  .issue-item {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    &:hover { background: var(--bg-hover); }
    &.active { background: var(--bg-hover); }
    &.migrated .title { color: var(--fg-dim); }

    // 长标题（含无空格长串）按字换行，不撑出横向滚动条
    .title { font-weight: 500; overflow-wrap: anywhere; word-break: break-word; }
    .meta { color: var(--fg-dim); font-size: 12px; margin-top: 2px; }
    .state-closed { color: var(--danger); }
  }
}
.detail {
  min-width: 0;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;

  .empty { display: grid; place-items: center; height: 100%; }
  .detail-head h3 { margin: 0 0 4px; }
  .detail-head .meta { color: var(--fg-dim); font-size: 12px; }
  .badge {
    margin-left: 6px;
    padding: 0 6px;
    border-radius: 4px;
    background: var(--bg-hover);
    color: var(--accent);
    font-size: 11px;
  }
  .body {
    flex: 1;
    margin: 12px 0;
    padding: 10px;
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 12px;
    overflow: auto;
  }
  .actions { display: flex; align-items: center; gap: 10px; }

  .copy-btn {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    border-radius: 5px;
    padding: 1px 8px;
    font-size: 12px;
    cursor: pointer;
    &:hover { background: var(--bg-hover); }
  }

  .ai-box {
    margin-top: 12px;
    padding: 10px 12px;
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-radius: 6px;

    .ai-head {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--fg-dim);
      margin-bottom: 6px;
      .grow { flex: 1; }
    }
    // markdown 渲染样式（参考 AiChatPanel 的 .md）
    .ai-text {
      word-break: break-word;
      line-height: 1.6;
      :deep(h2) { font-size: 14px; margin: 12px 0 4px; }
      :deep(h2:first-child) { margin-top: 0; }
      :deep(p) { margin: 4px 0; }
      :deep(ul), :deep(ol) { margin: 4px 0; padding-left: 20px; }
      :deep(code) { background: var(--bg-hover); padding: 0 4px; border-radius: 4px; }
      :deep(pre) { background: var(--bg-hover); padding: 8px; border-radius: 6px; overflow-x: auto; }
    }
  }
}
</style>
