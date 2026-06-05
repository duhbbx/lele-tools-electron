/** 10 位按秒、13 位按毫秒，其余长度按数值大小猜（< 1e12 视为秒）。 */
export function normalizeTs(input: string): number {
  const n = Number(input.trim())
  if (!Number.isFinite(n)) throw new Error('不是数字')
  return Math.abs(n) < 1e12 ? n * 1000 : n
}

export function tsToStrings(ms: number): { iso: string; local: string; date: Date } {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) throw new Error('非法时间戳')
  return { iso: d.toISOString(), local: d.toLocaleString(), date: d }
}
