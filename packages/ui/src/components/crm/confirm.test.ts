import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConfirmDelete } from './confirm'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useConfirmDelete', () => {
  it('第一次点进入确认态，3s 内再点执行', () => {
    const executed: number[] = []
    const { confirmingId, trigger } = useConfirmDelete((id) => {
      executed.push(id)
    })
    trigger(1)
    expect(confirmingId.value).toBe(1)
    expect(executed).toEqual([])
    trigger(1)
    expect(executed).toEqual([1])
    expect(confirmingId.value).toBeNull()
  })

  it('3s 超时自动复位，不执行', () => {
    const executed: number[] = []
    const { confirmingId, trigger } = useConfirmDelete((id) => {
      executed.push(id)
    })
    trigger(1)
    vi.advanceTimersByTime(3001)
    expect(confirmingId.value).toBeNull()
    trigger(1) // 重新进入确认态而不是执行
    expect(executed).toEqual([])
  })

  it('换一行点删除会切换确认目标', () => {
    const executed: number[] = []
    const { confirmingId, trigger } = useConfirmDelete((id) => {
      executed.push(id)
    })
    trigger(1)
    trigger(2)
    expect(confirmingId.value).toBe(2)
    expect(executed).toEqual([])
  })
})
