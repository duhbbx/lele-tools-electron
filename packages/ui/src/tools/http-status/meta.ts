import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'http-status',
  name: { zh: 'HTTP 状态码', en: 'HTTP Status Codes' },
  desc: { zh: 'HTTP 状态码速查表，支持搜索', en: 'HTTP status code reference with search' },
  category: 'misc',
  keywords: ['http', 'status', '404', '状态码'],
  icon: '🌐',
  load: () => import('./Tool.vue'),
}
