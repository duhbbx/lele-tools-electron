import { describe, expect, it } from 'vitest'
import { extractTitle } from './title'

describe('extractTitle', () => {
  it('取第一个一级标题', () => {
    expect(extractTitle('前言\n# 会议纪要\n内容')).toBe('会议纪要')
  })

  it('一级标题里的行内标记被剥掉', () => {
    expect(extractTitle('# **重点** `代码` 标题')).toBe('重点 代码 标题')
  })

  it('无一级标题时取第一行非空文本并剥掉 md 标记', () => {
    expect(extractTitle('\n\n- **重点**内容\n其他')).toBe('重点内容')
    expect(extractTitle('## 二级标题\n正文')).toBe('二级标题')
    expect(extractTitle('> 引用开头')).toBe('引用开头')
    expect(extractTitle('1. 第一条')).toBe('第一条') // 有序列表前缀被剥掉
    expect(extractTitle('10x 倍速笔记')).toBe('10x 倍速笔记') // 非列表的数字开头不被误剥
  })

  it('剥掉链接与图片标记保留文字', () => {
    expect(extractTitle('[链接文字](http://a.b) 后缀')).toBe('链接文字 后缀')
    expect(extractTitle('![图](notes-file://1/a.png) 说明')).toBe('图 说明')
  })

  it('全空返回空串', () => {
    expect(extractTitle('')).toBe('')
    expect(extractTitle('\n  \n')).toBe('')
  })

  it('截断到 20 个字符', () => {
    expect(extractTitle(`# ${'十'.repeat(30)}`)).toBe('十'.repeat(20))
    expect(extractTitle('# 刚好二十个字的标题不应该被截断哦正好啊哦')).toHaveLength(20)
  })
})
