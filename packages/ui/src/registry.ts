import type { Component } from 'vue'
import type { Locale } from './i18n'

export type ToolCategory = 'format' | 'text' | 'generator' | 'dev' | 'time' | 'misc'

export const CATEGORY_ORDER: ToolCategory[] = ['format', 'text', 'generator', 'dev', 'time', 'misc']

export const CATEGORY_LABEL: Record<ToolCategory, Record<Locale, string>> = {
  format: { zh: '编码 & 格式化', en: 'Encode & Format' },
  text: { zh: '文本', en: 'Text' },
  generator: { zh: '生成器', en: 'Generators' },
  dev: { zh: '开发协作', en: 'Dev Collaboration' },
  time: { zh: '时间', en: 'Time' },
  misc: { zh: '其他', en: 'Misc' },
}

export interface ToolMeta {
  id: string
  name: Record<Locale, string>
  desc: Record<Locale, string>
  category: ToolCategory
  /** 搜索关键词（中英拼都放这里） */
  keywords: string[]
  /** emoji 图标，后续可换 SVG */
  icon: string
  load: () => Promise<{ default: Component }>
}
