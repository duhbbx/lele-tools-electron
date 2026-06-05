export interface PasswordOpts {
  length: number
  lower: boolean
  upper: boolean
  digits: boolean
  symbols: boolean
}

const CLASSES: [keyof Omit<PasswordOpts, 'length'>, string][] = [
  ['lower', 'abcdefghijkmnpqrstuvwxyz'], // 去 l/o 易混字符
  ['upper', 'ABCDEFGHJKLMNPQRSTUVWXYZ'], // 去 I/O
  ['digits', '23456789'], // 去 0/1
  ['symbols', '!@#$%^&*_-+=?'],
]

function randInt(maxExclusive: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % maxExclusive
}

export function generatePassword(o: PasswordOpts): string {
  const enabled = CLASSES.filter(([k]) => o[k])
  if (enabled.length === 0) throw new Error('至少选择一类字符')
  if (o.length < enabled.length) throw new Error(`长度至少 ${enabled.length}`)
  const all = enabled.map(([, s]) => s).join('')
  // 先保证每类一个，再随机填充，最后洗牌
  const chars = enabled.map(([, s]) => s[randInt(s.length)])
  while (chars.length < o.length) chars.push(all[randInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
