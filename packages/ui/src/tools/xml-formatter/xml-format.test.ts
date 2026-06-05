/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { formatXml } from './xml-format'

describe('formatXml', () => {
  it('indents nested elements', () => {
    expect(formatXml('<a><b><c>x</c></b></a>')).toBe('<a>\n  <b>\n    <c>x</c>\n  </b>\n</a>')
  })
  it('keeps declaration and self-closing tags', () => {
    expect(formatXml('<?xml version="1.0"?><r><e/></r>')).toBe('<?xml version="1.0"?>\n<r>\n  <e/>\n</r>')
  })
  it('throws on malformed xml', () => {
    expect(() => formatXml('<a><b></a>')).toThrow()
  })
})
