import type { RouterScrollBehavior } from 'vue-router'

let cancelPendingScroll: (() => void) | undefined

/** 导航可能折行或展示反馈，定位时读取实际高度。 */
export function stickyHeaderOffset() {
  return (document.querySelector('.craft-header')?.getBoundingClientRect().height ?? 0) + 16
}

/** 等待广场当前查询的内容渲染，再恢复位置，避免被加载态的短页面截断。 */
function waitForDiscover(fullPath: string) {
  return new Promise<HTMLElement | null>(resolve => {
    const finish = (element: HTMLElement | null) => {
      observer.disconnect()
      cancelPendingScroll = undefined
      resolve(element)
    }
    const check = () => {
      const results = document.getElementById('discover')
      if (results?.dataset.scrollRoute === fullPath) finish(results)
    }
    const observer = new MutationObserver(check)
    cancelPendingScroll = () => finish(null)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-scroll-route'],
    })
    check()
  })
}

export const scrollBehavior: RouterScrollBehavior = async (to, from, savedPosition) => {
  // 重复点击同一链接不应取消尚在等待页面渲染的历史定位。
  if (to === from) return false
  cancelPendingScroll?.()
  // 订单和需求详情由各自的数据加载时机决定锚点与焦点。
  if (to.hash && (to.name === 'order-detail' || to.name === 'custom-request-detail')) return false
  if (to.name !== 'home') return savedPosition ?? false
  if (savedPosition || (to.hash === '#discover' && (from.name !== 'home' || from.hash !== to.hash))) {
    const results = await waitForDiscover(to.fullPath)
    if (!results || window.history.state?.current !== to.fullPath) return false
    return savedPosition ?? { el: results, top: stickyHeaderOffset() }
  }
  return to.fullPath !== from.fullPath ? { top: 0, left: 0 } : false
}
