import { onScopeDispose, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useConfirmation } from './useConfirmation'

interface Options {
  dirty: () => boolean
  busy: () => boolean
  active: () => boolean

}

/** 保护路由离开、编辑对象切换与浏览器离页时尚未保存的输入。 */
export function useUnsavedChanges(options: Options) {
  const confirm = useConfirmation()

  async function allowDiscard() {
    if (!options.active()) return true
    if (options.busy()) return false
    if (!options.dirty()) return true
    return confirm({ title: '离开编辑？', message: '未保存的修改将丢弃。', confirmLabel: '确认离开' })
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    event.preventDefault()
    event.returnValue = ''
  }

  watch(() => options.active() && (options.dirty() || options.busy()), shouldWarn => {
    if (shouldWarn) window.addEventListener('beforeunload', beforeUnload)
    else window.removeEventListener('beforeunload', beforeUnload)
  }, { immediate: true })
  onScopeDispose(() => window.removeEventListener('beforeunload', beforeUnload))

  onBeforeRouteLeave(allowDiscard)

  return allowDiscard
}
