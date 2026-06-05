import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'yaml-formatter',
  name: { zh: 'YAML 格式化', en: 'YAML Formatter' },
  desc: { zh: 'YAML 格式化与 JSON 互转', en: 'Format YAML and convert to/from JSON' },
  category: 'format',
  keywords: ['yaml', 'yml', 'json', '转换'],
  icon: '▤',
  load: () => import('./Tool.vue'),
}
