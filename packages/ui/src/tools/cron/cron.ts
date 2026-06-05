import { parseExpression } from 'cron-parser'

export function nextRuns(expr: string, count: number, from?: Date): Date[] {
  const it = parseExpression(expr, from ? { currentDate: from } : undefined)
  return Array.from({ length: count }, () => it.next().toDate())
}
