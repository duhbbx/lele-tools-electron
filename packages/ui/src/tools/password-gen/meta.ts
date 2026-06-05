import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'password-gen',
  name: { zh: '随机密码', en: 'Password Generator' },
  desc: { zh: '生成安全随机密码', en: 'Generate secure random passwords' },
  category: 'generator',
  keywords: ['password', 'random', '密码'],
  icon: '🔑',
  load: () => import('./Tool.vue'),
}
