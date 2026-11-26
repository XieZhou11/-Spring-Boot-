import { onScopeDispose, readonly, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

interface ConfirmationOptions {
  title: string
  message: string
  confirmLabel: string
}

interface Confirmation extends ConfirmationOptions {
  owner: symbol
  resolve: (confirmed: boolean) => void
  trigger: HTMLElement | null
}

const active = shallowRef<Confirmation>()

/** 确认结束立即释放请求，焦点返回仍处于页面中的触发控件。 */
export function finishConfirmation(confirmed: boolean) {
  const request = active.value
  if (!request) return
  active.value = undefined
  if (request.trigger?.isConnected) request.trigger.focus({ preventScroll: true })
  request.resolve(confirmed)
}

export const activeConfirmation = readonly(active)

/** 全站同一时刻只显示一个确认框。发起组件卸载或账号变化后取消未确认的操作。 */
export function useConfirmation() {
  const owner = Symbol()
  const auth = useAuthStore()
  function cancelOwnRequest() {
    if (active.value?.owner === owner) finishConfirmation(false)
  }
  watch([() => auth.session?.userId, () => auth.session?.roles.includes('ADMIN')], cancelOwnRequest, { flush: 'sync' })
  onScopeDispose(cancelOwnRequest)

  return function confirmAction(options: ConfirmationOptions): Promise<boolean> {
    if (active.value) return Promise.resolve(false)
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return new Promise(resolve => { active.value = { ...options, trigger, owner, resolve } })
  }
}
