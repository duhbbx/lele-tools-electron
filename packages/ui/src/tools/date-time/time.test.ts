import { describe, expect, it } from 'vitest'
import { normalizeTs, tsToStrings } from './time'

describe('timestamp utils', () => {
  it('detects seconds vs milliseconds', () => {
    expect(normalizeTs('1717545600')).toBe(1717545600000)
    expect(normalizeTs('1717545600000')).toBe(1717545600000)
  })
  it('throws on non-numeric', () => {
    expect(() => normalizeTs('abc')).toThrow()
  })
  it('formats iso', () => {
    expect(tsToStrings(0).iso).toBe('1970-01-01T00:00:00.000Z')
  })
})
