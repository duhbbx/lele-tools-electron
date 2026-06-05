import { ref } from 'vue'

export type Locale = 'zh' | 'en'
export const LOCALE_LABEL: Record<Locale, string> = { zh: '简体中文', en: 'English' }

export const locale = ref<Locale>('zh')
export function setLocale(l: Locale): void {
  locale.value = l
}

/** 壳层文案字典；工具名/描述不在这里（见 registry.ts ToolMeta.name）。 */
const dict: Record<string, Record<Locale, string>> = {
  'app.title': { zh: '乐乐的工具箱', en: 'Lele Tools' },
  'nav.search': { zh: '搜索工具…', en: 'Search tools…' },
  'nav.recent': { zh: '最近使用', en: 'Recent' },
  'welcome.hint': { zh: '从左侧选择一个工具开始', en: 'Pick a tool from the sidebar to start' },
  'tabs.close': { zh: '关闭', en: 'Close' },
  'settings.title': { zh: '设置', en: 'Settings' },
  'settings.language': { zh: '语言', en: 'Language' },
  'settings.theme': { zh: '主题', en: 'Theme' },
  'settings.theme.dark': { zh: '深色', en: 'Dark' },
  'settings.theme.light': { zh: '浅色', en: 'Light' },
  'settings.theme.system': { zh: '跟随系统', en: 'System' },
  'settings.ai': { zh: 'AI 助手', en: 'AI Assistant' },
  'settings.ai.provider': { zh: '服务商', en: 'Provider' },
  'settings.ai.apiKey': { zh: 'API Key', en: 'API Key' },
  'settings.ai.model': { zh: '模型', en: 'Model' },
  'settings.ai.baseUrl': { zh: 'Base URL', en: 'Base URL' },
  'settings.ai.test': { zh: '测试连接', en: 'Test connection' },
  'settings.ai.testOk': { zh: '连接成功', en: 'Connected' },
  'common.close': { zh: '关闭', en: 'Close' },
  'common.copy': { zh: '复制', en: 'Copy' },
  'common.copied': { zh: '已复制', en: 'Copied' },
  'common.clear': { zh: '清空', en: 'Clear' },
  'ai.title': { zh: 'AI 助手', en: 'AI Assistant' },
  'ai.placeholder': { zh: '问点什么…（Enter 发送，Shift+Enter 换行）', en: 'Ask anything… (Enter to send)' },
  'ai.send': { zh: '发送', en: 'Send' },
  'ai.stop': { zh: '停止', en: 'Stop' },
  'ai.notConfigured': { zh: '先在设置里配置 AI 服务商', en: 'Configure an AI provider in Settings first' },
}

export function t(key: string): string {
  return dict[key]?.[locale.value] ?? key
}
