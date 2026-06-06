/** 从 Markdown 内容提取笔记标题：
 *  1. 第一个一级标题（`# xxx`）；
 *  2. 否则第一行非空文本（剥掉 Markdown 标记）；
 *  3. 全空返回 ''（UI 层显示「无标题」）。
 *  统一截断到 20 个字符。 */
const MAX_TITLE = 20

export function extractTitle(content: string): string {
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)$/)
    if (m) return truncate(cleanInline(m[1]))
  }
  for (const line of lines) {
    const text = cleanInline(line)
    if (text) return truncate(text)
  }
  return ''
}

function cleanInline(s: string): string {
  return s
    .replace(/^#{1,6}\s+/, '') // 标题井号
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, '') // 列表前缀
    .replace(/^>\s*/, '') // 引用
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // 图片 → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接 → 文字
    .replace(/[*_`~]/g, '') // 强调/代码标记
    .trim()
}

function truncate(s: string): string {
  return [...s].slice(0, MAX_TITLE).join('')
}
