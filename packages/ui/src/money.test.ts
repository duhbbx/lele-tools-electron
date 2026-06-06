import { describe, expect, it } from 'vitest'
import { centsToYuan, yuanToCents } from './money'

describe('money', () => {
  it('round-trips', () => {
    expect(centsToYuan(123456)).toBe('1234.56')
    expect(yuanToCents('1234.56')).toBe(123456)
  })
  it('tolerates messy input', () => {
    expect(yuanToCents(' 1,234.5 ')).toBe(123450)
    expect(yuanToCents('abc')).toBe(0)
    expect(centsToYuan(0)).toBe('0.00')
  })
})
