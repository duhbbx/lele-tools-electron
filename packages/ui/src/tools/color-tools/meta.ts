import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'color-tools',
  name: { zh: '颜色工具', en: 'Color Tools' },
  desc: { zh: 'HEX / RGB / HSL 颜色互转', en: 'Convert between HEX, RGB and HSL colors' },
  category: 'misc',
  keywords: ['color', 'hex', 'rgb', 'hsl', '颜色'],
  icon: '🎨',
  load: () => import('./Tool.vue'),
}
