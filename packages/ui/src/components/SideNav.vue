<script setup lang="ts">
import { computed, ref } from 'vue'
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../registry'
import { locale, t } from '../i18n'
import { TOOLS } from '../tools'
import CrmTree from './CrmTree.vue'

const emit = defineEmits<{
  open: [toolId: string]
  'open-crm': [kind: 'crm-contact' | 'crm-project', refId: number, title: string]
}>()

const crmTree = ref<InstanceType<typeof CrmTree> | null>(null)

const query = ref('')

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

function refreshCrm(): void {
  void crmTree.value?.refresh()
}

defineExpose({ refreshCrm })
</script>

<template>
  <nav class="side-nav">
    <input v-model="query" class="input search" :placeholder="t('nav.search')" />
    <div class="scroll">
      <template v-for="g in grouped" :key="g.cat">
        <div class="cat">{{ g.label }}</div>
        <button v-for="m in g.tools" :key="m.id" class="item" :title="m.desc[locale]" @click="emit('open', m.id)">
          <span class="icon">{{ m.icon }}</span>{{ m.name[locale] }}
        </button>
      </template>
      <CrmTree ref="crmTree" @open="(kind, id, name) => emit('open-crm', kind, id, name)" />
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
