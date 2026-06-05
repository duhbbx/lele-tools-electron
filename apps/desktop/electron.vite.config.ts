import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'

// 工作区 TS 源码包打进产物；better-sqlite3 等原生模块保持 external。
const workspacePkgs = ['@lele/shared-types']

const NLS_SHIM = resolve(__dirname, '../../packages/ui/src/vendor/monaco-nls-shim.ts')

/**
 * Monaco 国际化拦截：把 monaco-editor/esm/vs/nls.js 整体换成我们的 shim。
 * 必须用 resolveId 插件 + 绝对路径终态匹配（resolve.alias 截不到 monaco 内部的相对引用），
 * 且 monaco-editor 要从 optimizeDeps 排除。详见 docs/踩坑与要点.md。
 */
function monacoNlsShim(): Plugin {
  let hits = 0
  return {
    name: 'lele:monaco-nls-shim',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (source === 'monaco-editor/esm/vs/nls.js' || source === 'monaco-editor/esm/vs/nls') {
        hits++
        return NLS_SHIM
      }
      if (importer && /[\\/]monaco-editor[\\/]/.test(importer) && /(^|[\\/])nls(\.js)?$/.test(source)) {
        const r = await this.resolve(source, importer, { skipSelf: true })
        if (!r?.id) return null
        const pathOnly = r.id.split('?')[0]
        if (/[\\/]monaco-editor[\\/]esm[\\/]vs[\\/]nls\.js$/.test(pathOnly)) {
          hits++
          if (hits <= 3) console.log(`[monacoNlsShim] redirected ${hits} → ${NLS_SHIM}`)
          return NLS_SHIM
        }
      }
      return null
    },
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePkgs })],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: { '@renderer': resolve('src/renderer/src') },
    },
    optimizeDeps: { exclude: ['@lele/ui', 'monaco-editor'] },
    plugins: [monacoNlsShim(), vue()],
  },
})
