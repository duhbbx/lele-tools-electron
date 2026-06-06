import '@lele/ui/styles.scss'
import { createApp } from 'vue'
import { extendDict, initSettings, type LelePluginUi, registerTools } from '@lele/ui'
import App from './App.vue'

// 构建期插件发现：plugins/<id>/ui/index.ts 导出 plugin（目录不存在即空集，开源克隆照常跑）
const pluginUiModules = import.meta.glob('../../../../../plugins/*/ui/index.ts', { eager: true })
for (const mod of Object.values(pluginUiModules)) {
  const plugin = (mod as { plugin?: LelePluginUi }).plugin
  if (!plugin) continue
  if (plugin.i18n) extendDict(plugin.i18n)
  registerTools(plugin.tools)
}

initSettings()
createApp(App).mount('#app')
