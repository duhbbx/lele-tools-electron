import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'xml-formatter',
  name: { zh: 'XML 格式化', en: 'XML Formatter' },
  desc: { zh: '格式化 / 压缩 XML', en: 'Format and minify XML' },
  category: 'format',
  keywords: ['xml', 'format', '格式化'],
  icon: '<>',
  load: () => import('./Tool.vue'),
}
