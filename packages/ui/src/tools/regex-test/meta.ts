import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'regex-test',
  name: { zh: '正则测试', en: 'Regex Tester' },
  desc: { zh: '正则表达式测试与匹配', en: 'Test and match regular expressions' },
  category: 'text',
  keywords: ['regex', 'regexp', '正则', '匹配'],
  icon: '.*',
  load: () => import('./Tool.vue'),
}
