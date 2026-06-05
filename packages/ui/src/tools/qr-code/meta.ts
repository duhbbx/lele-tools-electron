import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'qr-code',
  name: { zh: '二维码生成', en: 'QR Code' },
  desc: { zh: '将文本或 URL 生成二维码，支持纠错等级与尺寸调整，可下载 PNG', en: 'Generate QR codes from text or URLs with configurable size and error correction' },
  category: 'generator',
  keywords: ['qr', 'qrcode', '二维码'],
  icon: '▣',
  load: () => import('./Tool.vue'),
}
