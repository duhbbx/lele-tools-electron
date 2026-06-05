import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'issue-mover',
  name: { zh: 'Issue 搬运', en: 'Issue Mover' },
  desc: {
    zh: '把其它开源项目的 issue 批量搬到自己的仓库',
    en: 'Move issues from other repos into your own',
  },
  category: 'dev',
  icon: '📦',
  keywords: ['github', 'issue', '迁移', '搬运', 'migrate'],
  load: () => import('./Tool.vue'),
}
