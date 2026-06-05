import { describe, expect, it } from 'vitest'
import { countText } from './count'

describe('countText', () => {
  it('counts chars / no-space / lines / words / cjk', () => {
    const r = countText('hello 世界\nfoo bar')
    expect(r.chars).toBe(16)
    expect(r.charsNoSpace).toBe(13)
    expect(r.lines).toBe(2)
    expect(r.words).toBe(3) // hello foo bar（CJK 不算英文词）
    expect(r.cjk).toBe(2)
  })
  it('empty text', () => {
    expect(countText('')).toEqual({ chars: 0, charsNoSpace: 0, lines: 0, words: 0, cjk: 0 })
  })
})
