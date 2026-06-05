import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'text-crypto',
  name: { zh: '文本加解密', en: 'Text Encrypt' },
  desc: { zh: 'AES-256-GCM 口令加解密', en: 'Password-based AES-256-GCM' },
  category: 'text',
  icon: '🔐',
  keywords: ['aes', 'encrypt', 'decrypt', '加密', '解密'],
  load: () => import('./Tool.vue'),
}
