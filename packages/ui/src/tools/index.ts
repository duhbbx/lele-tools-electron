import type { ToolMeta } from '../registry'

export const TOOLS: ToolMeta[] = []

export function toolById(id: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.id === id)
}
