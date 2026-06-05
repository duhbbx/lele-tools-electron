import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'base64',
  name: { zh: 'Base64 编解码', en: 'Base64' },
  desc: { zh: 'Base64 编码与解码（UTF-8 安全）', en: 'Base64 encode and decode (UTF-8 safe)' },
  category: 'format',
  keywords: ['base64', 'encode', 'decode', '编码', '解码'],
  icon: '🅱',
  load: () => import('./Tool.vue'),
}
