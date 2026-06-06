export { default as Workspace } from './Workspace.vue'
export { extendDict, type Locale, LOCALE_LABEL, locale, setLocale, t } from './i18n'
export { registerTools, TOOLS, toolById } from './tools'
export {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type LelePluginUi,
  type ToolCategory,
  type ToolMeta,
} from './registry'
export { centsToYuan, yuanToCents } from './money'
export { copyText } from './clipboard'
export { default as ToolTabs } from './components/ToolTabs.vue'
export {
  activeAiProfile,
  addAiProfile,
  AI_PROVIDER_DEFAULTS,
  AI_PROVIDER_LABEL,
  AI_PROVIDER_ORDER,
  type AiProfile,
  type AiProvider,
  type AiProviderConfig,
  initSettings,
  isActiveAiConfigured,
  isLocalAiProvider,
  removeAiProfile,
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
