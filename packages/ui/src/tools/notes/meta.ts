import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'notes',
  name: { zh: '记事本', en: 'Notes' },
  desc: { zh: 'Markdown 笔记，树状管理，支持图片与附件', en: 'Markdown notes with tree navigation and attachments' },
  category: 'text',
  keywords: ['markdown', 'note', 'notes', '笔记', '记事本', 'jishiben', 'biji'],
  icon: '📝',
  load: () => import('./Tool.vue'),
}
