import type { ToolMeta } from '../registry'
import { meta as base64 } from './base64/meta'
import { meta as baseConvert } from './base-convert/meta'
import { meta as charCounter } from './char-counter/meta'
import { meta as colorTools } from './color-tools/meta'
import { meta as cronTool } from './cron/meta'
import { meta as dateTime } from './date-time/meta'
import { meta as httpStatus } from './http-status/meta'
import { meta as issueMover } from './issue-mover/meta'
import { meta as jsonFormatter } from './json-formatter/meta'
import { meta as passwordGen } from './password-gen/meta'
import { meta as qrCode } from './qr-code/meta'
import { meta as regexTest } from './regex-test/meta'
import { meta as textCrypto } from './text-crypto/meta'
import { meta as uuidGen } from './uuid-gen/meta'
import { meta as xmlFormatter } from './xml-formatter/meta'
import { meta as yamlFormatter } from './yaml-formatter/meta'
import { meta as notesTool } from './notes/meta'

export const TOOLS: ToolMeta[] = [jsonFormatter, xmlFormatter, yamlFormatter, base64, baseConvert, charCounter, regexTest, textCrypto, passwordGen, uuidGen, qrCode, dateTime, cronTool, colorTools, httpStatus, issueMover, notesTool]

export function toolById(id: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.id === id)
}

/** 插件工具注册（渲染层入口在 app mount 前调用；同 id 幂等） */
export function registerTools(metas: ToolMeta[]): void {
  for (const m of metas) {
    if (!TOOLS.some((t) => t.id === m.id)) TOOLS.push(m)
  }
}
