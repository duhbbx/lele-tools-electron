import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'date-time',
  name: { zh: '时间戳转换', en: 'Timestamp' },
  desc: { zh: '时间戳与日期互转', en: 'Convert between timestamp and date' },
  category: 'time',
  keywords: ['timestamp', 'unix', 'date', '时间戳', '日期'],
  icon: '🕐',
  load: () => import('./Tool.vue'),
}
