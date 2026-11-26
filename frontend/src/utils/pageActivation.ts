import { onMounted, onUnmounted } from 'vue'

const subscribers = new Set<() => void>()
let timer: number | undefined
const activationDelay = 80

/** 浏览器切回时通常先后通知焦点和可见性，同一轮只刷新一次。 */
function scheduleActivation() {
  if (document.visibilityState !== 'visible') return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    timer = undefined
    if (document.visibilityState === 'visible') subscribers.forEach(refresh => refresh())
  }, activationDelay)
}

export function subscribePageActivation(refresh: () => void) {
  if (!subscribers.size) {
    window.addEventListener('focus', scheduleActivation)
    document.addEventListener('visibilitychange', scheduleActivation)
  }
  subscribers.add(refresh)
  return () => {
    subscribers.delete(refresh)
    if (subscribers.size) return
    window.clearTimeout(timer)
    timer = undefined
    window.removeEventListener('focus', scheduleActivation)
    document.removeEventListener('visibilitychange', scheduleActivation)
  }
}

export function usePageActivation(refresh: () => void) {
  let unsubscribe: (() => void) | undefined
  onMounted(() => { unsubscribe = subscribePageActivation(refresh) })
  onUnmounted(() => unsubscribe?.())
}

/** 同一资源的激活查询仍在进行时，迟到的焦点事件复用该次查询。 */
export function useActivationRead(key: () => string, read: () => Promise<void>) {
  const pending = new Set<string>()
  usePageActivation(() => {
    const current = key()
    if (pending.has(current)) return
    pending.add(current)
    void read().catch(error => {
      // 页面处理预期的读取失败，仍记录意外错误以便诊断。
      console.error('页面恢复时读取失败', error)
    }).finally(() => pending.delete(current))
  })
}
