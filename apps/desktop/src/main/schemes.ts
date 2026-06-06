import { protocol } from 'electron'

/** 自定义协议特权声明；registerSchemesAsPrivileged 整个 app 只能调用一次且须在 app ready 前，
 *  所有 scheme 集中在这里登记（handler 仍在各自 ipc 模块的 registerXxxProtocol 里）。 */
export function registerAppSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'notes-file', privileges: { secure: true, supportFetchAPI: true, stream: true } },
    { scheme: 'crm-file', privileges: { secure: true, supportFetchAPI: true, stream: true } },
  ])
}
