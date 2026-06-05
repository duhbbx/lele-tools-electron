import type { ToolMeta } from '../registry'
import { meta as base64 } from './base64/meta'
import { meta as baseConvert } from './base-convert/meta'
import { meta as charCounter } from './char-counter/meta'
import { meta as jsonFormatter } from './json-formatter/meta'
import { meta as passwordGen } from './password-gen/meta'
import { meta as regexTest } from './regex-test/meta'
import { meta as textCrypto } from './text-crypto/meta'
import { meta as uuidGen } from './uuid-gen/meta'
import { meta as xmlFormatter } from './xml-formatter/meta'
import { meta as yamlFormatter } from './yaml-formatter/meta'

export const TOOLS: ToolMeta[] = [jsonFormatter, xmlFormatter, yamlFormatter, base64, baseConvert, charCounter, regexTest, textCrypto, passwordGen, uuidGen]

export function toolById(id: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.id === id)
}
