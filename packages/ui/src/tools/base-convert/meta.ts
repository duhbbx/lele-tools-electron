import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'base-convert',
  name: { zh: '进制转换', en: 'Base Converter' },
  desc: { zh: '任意进制（2-36）互转', en: 'Convert between any bases (2–36)' },
  category: 'format',
  keywords: ['hex', 'binary', 'oct', '进制', '二进制', '十六进制'],
  icon: '⇄',
  load: () => import('./Tool.vue'),
}
