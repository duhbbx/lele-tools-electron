import { protocol } from 'electron'

/** 自定义协议特权声明；registerSchemesAsPrivileged 整个 app 只能调用一次且须在 app ready 前，
 *  所有 scheme 集中在这里登记（handler 仍在各自模块的 registerXxxProtocol 里）。
 *  plugin-file 是壳层提供的通用插件文件协议（plugin-file://<pluginId>/...），无插件时也声明，保持 CSP 稳定。 */
export function registerAppSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'notes-file', privileges: { secure: true, supportFetchAPI: true, stream: true } },
    { scheme: 'plugin-file', privileges: { secure: true, supportFetchAPI: true, stream: true } },
  ])
}
