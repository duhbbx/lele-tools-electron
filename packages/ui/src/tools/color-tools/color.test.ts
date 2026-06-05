import { describe, expect, it } from 'vitest'
import { hexToRgb, rgbToHex, rgbToHsl } from './color'

describe('color conversions', () => {
  it('hex ↔ rgb', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 })
    expect(hexToRgb('f80')).toEqual({ r: 255, g: 136, b: 0 }) // 短格式
    expect(rgbToHex({ r: 255, g: 128, b: 0 })).toBe('#ff8000')
  })
  it('rgb → hsl', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 })
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 })
  })
  it('invalid hex throws', () => {
    expect(() => hexToRgb('#zzz')).toThrow()
  })
})
