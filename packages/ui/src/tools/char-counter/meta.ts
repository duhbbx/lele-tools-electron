import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'char-counter',
  name: { zh: '字符统计', en: 'Character Counter' },
  desc: { zh: '统计字符数、单词数、中日韩字符', en: 'Count chars, words, CJK characters' },
  category: 'text',
  keywords: ['count', 'word', '统计', '字数'],
  icon: '🔢',
  load: () => import('./Tool.vue'),
}
