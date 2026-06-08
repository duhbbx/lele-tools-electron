<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ImRepo, ImRepoKind } from '@lele/shared-types'

const props = defineProps<{ instanceId: number }>()
const emit = defineEmits<{ changed: [] }>()

const repos = ref<ImRepo[]>([])
const error = ref('')
/** repoId → 拉取/操作的状态文案 */
const status = ref<Record<number, string>>({})
const busy = ref<Record<number, boolean>>({})

const sources = computed(() => repos.value.filter((r) => r.kind === 'source'))
const target = computed(() => repos.value.find((r) => r.kind === 'target') ?? null)

// 新增表单
const addSlug = ref('') // owner/repo
const addToken = ref('')

async function load(): Promise<void> {
  error.value = ''
  try {
    repos.value = await window.api.issueMover.repos.listByInstance(props.instanceId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function parseSlug(slug: string): { owner: string; name: string } | null {
  const m = slug.trim().replace(/^https?:\/\/github\.com\//i, '').match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/)
  return m ? { owner: m[1], name: m[2] } : null
}

async function addRepo(kind: ImRepoKind): Promise<void> {
  const parsed = parseSlug(addSlug.value)
  if (!parsed) {
    error.value = '请填 owner/repo，例如 facebook/react'
    return
  }
  error.value = ''
  await window.api.issueMover.repos.add(props.instanceId, { kind, ...parsed, token: addToken.value.trim() })
  addSlug.value = ''
  addToken.value = ''
  await load()
  emit('changed')
}

async function saveRepo(r: ImRepo): Promise<void> {
  await window.api.issueMover.repos.update(r.id, { owner: r.owner, name: r.name, token: r.token })
  status.value[r.id] = '已保存'
  emit('changed')
}

async function removeRepo(r: ImRepo): Promise<void> {
  if (!window.confirm(`移除仓库 ${r.owner}/${r.name}？其已拉取的 issue 记录会一并删除。`)) return
  await window.api.issueMover.repos.remove(r.id)
  await load()
  emit('changed')
}

async function pull(r: ImRepo): Promise<void> {
  busy.value[r.id] = true
  status.value[r.id] = '拉取中…'
  const res = await window.api.issueMover.repos.pull(r.id)
  busy.value[r.id] = false
  status.value[r.id] = res.ok ? `已拉取 ${res.count} 条` : `失败：${res.error}`
  if (res.ok) emit('changed')
}

onMounted(load)
</script>

<template>
  <div class="cfg">
    <p v-if="error" class="error">{{ error }}</p>

    <section>
      <h3>源仓库（issue 来源，可多个）</h3>
      <p v-if="!sources.length" class="hint">还没有源仓库。</p>
      <div v-for="r in sources" :key="r.id" class="repo-row">
        <input v-model="r.owner" class="input" style="width: 130px" placeholder="owner" />
        <span>/</span>
        <input v-model="r.name" class="input" style="width: 150px" placeholder="repo" />
        <input v-model="r.token" class="input grow" type="password" placeholder="token（公开库可留空）" />
        <button class="btn" @click="saveRepo(r)">保存</button>
        <button class="btn" :disabled="busy[r.id]" @click="pull(r)">拉取</button>
        <button class="btn" @click="removeRepo(r)">移除</button>
        <span class="hint">{{ status[r.id] }}</span>
      </div>
    </section>

    <section>
      <h3>目标仓库（搬运目的地，唯一）</h3>
      <p v-if="!target" class="hint">未配置目标仓库。下方填好后点「设为目标」。</p>
      <div v-else class="repo-row">
        <input v-model="target.owner" class="input" style="width: 130px" placeholder="owner" />
        <span>/</span>
        <input v-model="target.name" class="input" style="width: 150px" placeholder="repo" />
        <input v-model="target.token" class="input grow" type="password" placeholder="token（需写权限）" />
        <button class="btn" @click="saveRepo(target)">保存</button>
        <button class="btn" :disabled="busy[target.id]" @click="pull(target)">拉取</button>
        <button class="btn" @click="removeRepo(target)">移除</button>
        <span class="hint">{{ status[target.id] }}</span>
      </div>
    </section>

    <section class="add">
      <h3>新增仓库</h3>
      <div class="repo-row">
        <input v-model="addSlug" class="input" style="width: 240px" placeholder="owner/repo，如 facebook/react" />
        <input v-model="addToken" class="input grow" type="password" placeholder="token（可留空）" />
        <button class="btn primary" @click="addRepo('source')">加为源</button>
        <button class="btn" :disabled="!!target" @click="addRepo('target')">设为目标</button>
      </div>
      <p class="hint">目标仓库唯一；已有目标时需先移除再设新的。token 仅存于本地数据库。</p>
    </section>
  </div>
</template>

<style scoped lang="scss">
.cfg {
  height: 100%;
  overflow: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 18px;

  h3 { margin: 0 0 8px; font-size: 14px; }
  .repo-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .grow { flex: 1; min-width: 120px; }
}
</style>
