const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

/** 任意 2-36 进制互转，BigInt 实现不丢精度。 */
export function convertBase(value: string, from: number, to: number): string {
  const v = value.trim().toLowerCase()
  if (!v) throw new Error('empty input')
  const neg = v.startsWith('-')
  const body = neg ? v.slice(1) : v
  let acc = 0n
  const fromB = BigInt(from)
  for (const ch of body) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= from) throw new Error(`非法字符 "${ch}" (base ${from})`)
    acc = acc * fromB + BigInt(d)
  }
  if (acc === 0n) return '0'
  const toB = BigInt(to)
  let out = ''
  while (acc > 0n) {
    out = DIGITS[Number(acc % toB)] + out
    acc /= toB
  }
  return (neg ? '-' : '') + out
}
