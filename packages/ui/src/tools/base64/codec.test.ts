import { describe, expect, it } from 'vitest'
import { decodeB64, encodeB64 } from './codec'

describe('base64 codec (UTF-8 safe)', () => {
  it('roundtrips ascii', () => {
    expect(decodeB64(encodeB64('hello'))).toBe('hello')
    expect(encodeB64('hello')).toBe('aGVsbG8=')
  })
  it('roundtrips chinese + emoji', () => {
    const s = '乐乐的工具箱 🧰'
    expect(decodeB64(encodeB64(s))).toBe(s)
  })
  it('decode throws on invalid input', () => {
    expect(() => decodeB64('!!!not-base64!!!')).toThrow()
  })
})
