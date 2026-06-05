export { default as Workspace } from './Workspace.vue'
export { type Locale, LOCALE_LABEL, locale, setLocale, t } from './i18n'
export { TOOLS, toolById } from './tools'
export { CATEGORY_LABEL, CATEGORY_ORDER, type ToolCategory, type ToolMeta } from './registry'
export {
  AI_PROVIDER_DEFAULTS,
  AI_PROVIDER_LABEL,
  AI_PROVIDER_ORDER,
  type AiProvider,
  type AiProviderConfig,
  initSettings,
  isActiveAiConfigured,
  isLocalAiProvider,
  resolvedTheme,
  settings,
} from './settings'
export {
  type AiTestResult,
  askAiChat,
  askAiChatStream,
  type ChatMessage,
  type ChatOptions,
  currentProvider,
  testAiProvider,
} from './ai'
