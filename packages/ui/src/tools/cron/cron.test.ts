import { describe, expect, it } from 'vitest'
import { nextRuns } from './cron'

describe('cron nextRuns', () => {
  it('every-minute cron returns ascending future dates', () => {
    const runs = nextRuns('* * * * *', 3, new Date('2026-06-05T00:00:30Z'))
    expect(runs).toHaveLength(3)
    expect(runs[0].toISOString()).toBe('2026-06-05T00:01:00.000Z')
    expect(runs[1].getTime()).toBeGreaterThan(runs[0].getTime())
  })
  it('throws on invalid expression', () => {
    expect(() => nextRuns('99 * * * *', 1)).toThrow()
  })
})
