import type { RouterScrollBehavior } from 'vue-router'

let cancelPendingScroll: (() => void) | undefined

/** 导航可能折行或展示反馈，定位时读取实际高度。 */
export function stickyHeaderOffset() {
  return (document.querySelector('.craft-header')?.getBoundingClientRect().height ?? 0) + 16
}

/** 等待目标数据页完成首屏渲染，避免历史位置被加载态的短页面截断。 */
function waitForScrollTarget(find: () => HTMLElement | null, ...attributes: string[]) {
  return new Promise<HTMLElement | null>(resolve => {
    const finish = (element: HTMLElement | null) => {
      observer.disconnect()
      cancelPendingScroll = undefined
      resolve(element)
    }
    const check = () => {
      const element = find()
      if (element) finish(element)
    }
    const observer = new MutationObserver(check)
    cancelPendingScroll = () => finish(null)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: attributes,
    })
    check()
  })
}

function isOrderDetail(name: unknown) {
  return name === 'order-detail' || name === 'order-detail-section'
}

export const scrollBehavior: RouterScrollBehavior = async (to, from, savedPosition) => {
  // 重复点击同一链接不应取消尚在等待页面渲染的历史定位。
  if (to === from) return false
  cancelPendingScroll?.()
  if (isOrderDetail(to.name)) {
    const progress = to.name === 'order-detail' && /^#progress-[1-9]\d*$/.test(to.hash)
    if (savedPosition || progress) {
      const restoreAlongsideList = !!savedPosition?.top && to.name === 'order-detail' && !window.matchMedia('(max-width: 840px)').matches
      const detail = await waitForScrollTarget(() => {
        const content = document.querySelector<HTMLElement>('.craftflow-order-main')
        if (content?.dataset.orderScrollRoute !== to.fullPath) return null
        if (restoreAlongsideList && !document.querySelector('[data-order-list-ready="true"]')) return null
        return content
      }, 'data-order-scroll-route', 'data-order-list-ready')
      if (!detail || window.history.state?.current !== to.fullPath) return false
      if (savedPosition) return savedPosition
      const anchor = document.getElementById(to.hash.slice(1))
      anchor?.focus({ preventScroll: true })
      return anchor ? { el: anchor, top: stickyHeaderOffset() } : { top: 0 }
    }
    if (to.name === 'order-detail-section' || from.name === 'order-detail-section') return { top: 0, left: 0 }
    // 左栏持续挂载。选中较靠后的订单时，只在概览已滚出视口时回到标题位置。
    if (from.name === 'orders' || from.name === 'order-detail') {
      if (window.matchMedia('(max-width: 840px)').matches) return { top: 0, left: 0 }
      const main = document.querySelector<HTMLElement>('.craftflow-order-main')
      const offset = stickyHeaderOffset()
      if (main && main.getBoundingClientRect().top < offset) return { el: main, top: offset }
      return false
    }
    return { top: 0, left: 0 }
  }
  if (to.hash && to.name === 'custom-request-detail') return false
  if (isOrderDetail(from.name) && to.path.startsWith('/messages/conversations/') && !savedPosition) return { top: 0, left: 0 }
  if (to.name !== 'home') return savedPosition ?? false
  if (savedPosition || (to.hash === '#discover' && (from.name !== 'home' || from.hash !== to.hash))) {
    const results = await waitForScrollTarget(() => {
      const content = document.getElementById('discover')
      return content?.dataset.scrollRoute === to.fullPath ? content : null
    }, 'data-scroll-route')
    if (!results || window.history.state?.current !== to.fullPath) return false
    return savedPosition ?? { el: results, top: stickyHeaderOffset() }
  }
  if (from.name === 'home' && to.path === from.path && to.hash === from.hash && to.query.categoryId !== from.query.categoryId) return false
  return to.fullPath !== from.fullPath ? { top: 0, left: 0 } : false
}
