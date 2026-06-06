import type { LelePluginMain, PluginMainContext } from '@lele/shared-types'
import type Database from 'better-sqlite3'
import { protocol } from 'electron'

/** 构建期插件发现：plugins/<id>/main/index.ts 导出 plugin（目录不存在即空集） */
const modules = import.meta.glob('../../../../plugins/*/main/index.ts', { eager: true })

export const plugins: LelePluginMain[] = Object.values(modules)
  .map((m) => (m as { plugin?: LelePluginMain }).plugin)
  .filter((p): p is LelePluginMain => Boolean(p))

/** 基础 migrate 之后调用（db/sqlite.ts getDb 内） */
export function migratePlugins(db: Database.Database): void {
  for (const p of plugins) p.migrate?.(db)
}

export function registerPluginIpc(ctx: PluginMainContext): void {
  for (const p of plugins) p.registerIpc?.(ctx)
}

/** app ready 之后调用：plugin-file://<pluginId>/... 按 hostname 路由到对应插件 */
export function registerPluginProtocol(): void {
  protocol.handle('plugin-file', (request) => {
    const url = new URL(request.url)
    const p = plugins.find((x) => x.id === url.hostname)
    if (!p?.resolveFile) return new Response('not found', { status: 404 })
    return p.resolveFile(url)
  })
}
