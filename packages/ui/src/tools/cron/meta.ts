import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'cron',
  name: { zh: 'Cron 表达式', en: 'Cron Parser' },
  desc: { zh: '解析 Cron 表达式，查看下次执行时间', en: 'Parse cron expressions and preview next runs' },
  category: 'time',
  keywords: ['cron', 'crontab', '定时'],
  icon: '⏰',
  load: () => import('./Tool.vue'),
}
