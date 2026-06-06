/**
 * Money utilities — always store amounts in integer cents (分).
 * String-based parse avoids float precision errors.
 */

/**
 * Convert a yuan string to integer cents.
 * Strips whitespace and commas, handles optional decimal part.
 * Returns 0 for non-numeric input.
 */
export function yuanToCents(yuan: string): number {
  const cleaned = yuan.replace(/[\s,]/g, '')
  if (!cleaned || !/^-?\d+(\.\d*)?$/.test(cleaned)) return 0
  const [intPart, fracPart = ''] = cleaned.split('.')
  // Pad/trim fraction to exactly 2 digits
  const fraction = (`${fracPart}00`).slice(0, 2)
  const intVal = Number.parseInt(intPart, 10)
  const fracVal = Number.parseInt(fraction, 10)
  const sign = intVal < 0 || cleaned.startsWith('-') ? -1 : 1
  return sign * (Math.abs(intVal) * 100 + fracVal)
}

/**
 * Convert integer cents to a yuan display string (e.g. 123456 → '1234.56').
 */
export function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2)
}
