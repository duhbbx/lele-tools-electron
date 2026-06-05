import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'json-formatter',
  name: { zh: 'JSON 格式化', en: 'JSON Formatter' },
  desc: { zh: '格式化 / 压缩 / 校验 JSON', en: 'Format, minify and validate JSON' },
  category: 'format',
  keywords: ['json', 'format', 'pretty', '格式化'],
  icon: '{}',
  load: () => import('./Tool.vue'),
}
