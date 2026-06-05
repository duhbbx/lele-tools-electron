import { describe, expect, it } from 'vitest'
import { generatePassword } from './gen'

describe('generatePassword', () => {
  it('respects length', () => {
    expect(generatePassword({ length: 24, lower: true, upper: true, digits: true, symbols: false })).toHaveLength(24)
  })
  it('contains at least one char from each enabled class', () => {
    for (let i = 0; i < 20; i++) {
      const p = generatePassword({ length: 8, lower: true, upper: true, digits: true, symbols: true })
      expect(p).toMatch(/[a-z]/)
      expect(p).toMatch(/[A-Z]/)
      expect(p).toMatch(/\d/)
      expect(p).toMatch(/[^a-zA-Z0-9]/)
    }
  })
  it('throws when no class enabled or length too short', () => {
    expect(() => generatePassword({ length: 8, lower: false, upper: false, digits: false, symbols: false })).toThrow()
    expect(() => generatePassword({ length: 2, lower: true, upper: true, digits: true, symbols: true })).toThrow()
  })
})
