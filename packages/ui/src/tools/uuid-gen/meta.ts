import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'uuid-gen',
  name: { zh: 'UUID 生成', en: 'UUID Generator' },
  desc: { zh: '批量生成 UUID v4', en: 'Generate UUID v4 in bulk' },
  category: 'generator',
  keywords: ['uuid', 'guid', '生成'],
  icon: '🆔',
  load: () => import('./Tool.vue'),
}
