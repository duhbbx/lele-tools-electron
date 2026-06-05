<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../registry'
import { locale, t } from '../i18n'
import { TOOLS, toolById } from '../tools'

const emit = defineEmits<{ open: [toolId: string] }>()

const query = ref('')
const recents = ref<string[]>([])

onMounted(async () => {
  recents.value = (await window.api?.recents?.list?.(6)) ?? []
})
/** Workspace 打开工具后调用，刷新最近使用 */
async function refreshRecents(): Promise<void> {
  recents.value = (await window.api?.recents?.list?.(6)) ?? []
}
defineExpose({ refreshRecents })

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return TOOLS
  return TOOLS.filter(
    (m) =>
      m.name.zh.includes(q) ||
      m.name.en.toLowerCase().includes(q) ||
      m.keywords.some((k) => k.toLowerCase().includes(q)),
  )
})

const grouped = computed(() =>
  CATEGORY_ORDER.map((c) => ({
    cat: c,
    label: CATEGORY_LABEL[c][locale.value],
    tools: filtered.value.filter((m) => m.category === c),
  })).filter((g) => g.tools.length > 0),
)
</script>

<template>
  <nav class="side-nav">
    <input v-model="query" class="input search" :placeholder="t('nav.search')" />
    <div class="scroll">
      <template v-if="!query && recents.length">
        <div class="cat">{{ t('nav.recent') }}</div>
        <button
          v-for="id in recents"
          :key="'r-' + id"
          class="item"
          @click="emit('open', id)"
        >
          <span class="icon">{{ toolById(id)?.icon }}</span>{{ toolById(id)?.name[locale] ?? id }}
        </button>
      </template>
      <template v-for="g in grouped" :key="g.cat">
        <div class="cat">{{ g.label }}</div>
        <button v-for="m in g.tools" :key="m.id" class="item" :title="m.desc[locale]" @click="emit('open', m.id)">
          <span class="icon">{{ m.icon }}</span>{{ m.name[locale] }}
        </button>
      </template>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.side-nav {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid var(--border);
  background: var(--bg-soft);
  .search { margin: 10px 10px 8px; }
  .scroll { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: 10px; }
  .cat {
    padding: 8px 12px 4px;
    font-size: 11px;
    color: var(--fg-dim);
    text-transform: uppercase;
  }
  .item {
    display: block;
    width: 100%;
    padding: 5px 14px;
    border: 0;
    background: none;
    color: var(--fg);
    text-align: left;
    cursor: pointer;
    border-radius: 0;
    &:hover { background: var(--bg-hover); }
    .icon { display: inline-block; width: 22px; }
  }
}
</style>
