import { ref } from 'vue'

/** 两步删除确认（同 CRM 编辑器既有模式）：第一次点击进入确认态，3s 内再点执行，超时自动复位。 */
export function useConfirmDelete(execute: (id: number) => void | Promise<void>) {
  const confirmingId = ref<number | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  function reset(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    confirmingId.value = null
  }

  function trigger(id: number): void {
    if (confirmingId.value === id) {
      reset()
      void execute(id)
      return
    }
    if (timer !== null) clearTimeout(timer)
    confirmingId.value = id
    timer = setTimeout(reset, 3000)
  }

  return { confirmingId, trigger }
}
