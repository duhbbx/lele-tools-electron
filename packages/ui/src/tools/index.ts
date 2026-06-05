import type { ToolMeta } from '../registry'
import { meta as base64 } from './base64/meta'
import { meta as baseConvert } from './base-convert/meta'
import { meta as jsonFormatter } from './json-formatter/meta'
import { meta as xmlFormatter } from './xml-formatter/meta'
import { meta as yamlFormatter } from './yaml-formatter/meta'

export const TOOLS: ToolMeta[] = [jsonFormatter, xmlFormatter, yamlFormatter, base64, baseConvert]

export function toolById(id: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.id === id)
}
