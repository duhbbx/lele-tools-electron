import { describe, expect, it } from 'vitest'
import { convertBase } from './convert'

describe('convertBase', () => {
  it('dec → hex/bin/oct', () => {
    expect(convertBase('255', 10, 16)).toBe('ff')
    expect(convertBase('255', 10, 2)).toBe('11111111')
    expect(convertBase('255', 10, 8)).toBe('377')
  })
  it('hex → dec, case-insensitive', () => {
    expect(convertBase('FF', 16, 10)).toBe('255')
    expect(convertBase('ff', 16, 10)).toBe('255')
  })
  it('handles big values via BigInt', () => {
    expect(convertBase('ffffffffffffffff', 16, 10)).toBe('18446744073709551615')
  })
  it('rejects digits out of base', () => {
    expect(() => convertBase('129', 2, 10)).toThrow()
  })
  it('supports negative numbers', () => {
    expect(convertBase('-ff', 16, 10)).toBe('-255')
  })
})
