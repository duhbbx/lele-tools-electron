export interface TextStats {
  chars: number
  charsNoSpace: number
  lines: number
  words: number
  cjk: number
}

export function countText(s: string): TextStats {
  if (!s) return { chars: 0, charsNoSpace: 0, lines: 0, words: 0, cjk: 0 }
  const chars = [...s].length
  const charsNoSpace = [...s.replace(/\s/g, '')].length
  const lines = s.split('\n').length
  const words = (s.match(/[A-Za-z0-9_'-]+/g) ?? []).length
  const cjk = (s.match(/[一-鿿㐀-䶿]/g) ?? []).length
  return { chars, charsNoSpace, lines, words, cjk }
}
