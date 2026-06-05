/** 浏览器 DOMParser 校验 + 手写缩进序列化（不引第三方）。 */
export function formatXml(src: string, indent = '  '): string {
  const doc = new DOMParser().parseFromString(src, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('XML 解析失败 / malformed XML')

  // 在 > < 之间断行，再按标签开闭算缩进
  const tokens = src
    .replace(/>\s+</g, '><')
    .replace(/></g, '>\n<')
    .split('\n')
  let depth = 0
  const out: string[] = []
  for (const tk of tokens) {
    const isClose = /^<\//.test(tk)
    const isSelf = /\/>$/.test(tk) || /^<\?/.test(tk) || /^<!/.test(tk)
    const isOpenAndClose = /^<[^/!?][^>]*>.*<\/[^>]+>$/.test(tk)
    if (isClose) depth = Math.max(0, depth - 1)
    out.push(indent.repeat(depth) + tk)
    if (!isClose && !isSelf && !isOpenAndClose && /^</.test(tk)) depth++
  }
  return out.join('\n')
}
