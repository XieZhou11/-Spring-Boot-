import type { HistoryState, Router } from 'vue-router'

type SavedHistoryView = {
  key: string
  path: string
  userId: string | null
  role: string | null
  focus: string | null
  scroll: { name: string; left: number; top: number }[]
}

let activeView: SavedHistoryView | undefined
const visitedViews = new Map<string, SavedHistoryView>()

/** 后退和前进已切换浏览器条目，保留当前渲染页面对应的上一条记录。 */
export function activateHistoryView(state: HistoryState, path: string, userId: string | null, role: string | null) {
  activeView = savedHistoryView(state, path, userId, role)
}

/** 只记录视图坐标和触发控件标识，业务筛选与页码由 URL 提供。 */
export function saveHistoryView(router: Router, path: string, userId: string | null, role: string | null) {
  const state = router.options.history.state
  const canUpdateEntry = state.current === path
  const previous = canUpdateEntry ? savedHistoryView(state, path, userId, role) : activeView
  if (!canUpdateEntry && (!previous || previous.path !== path || previous.userId !== userId || previous.role !== role)) return
  const root = findHistoryView(path, 'historyView') ?? historyView(path)
  if (!root) return

  const focus = document.activeElement?.closest<HTMLElement>('[data-history-focus]')
  const scroll = [...root.querySelectorAll<HTMLElement>('[data-history-scroll]')].map(element => ({
    name: element.dataset.historyScroll ?? '',
    left: element.scrollLeft,
    top: element.scrollTop,
  }))
  const snapshot: SavedHistoryView = {
    key: previous?.key ?? crypto.randomUUID(),
    path,
    userId,
    role,
    focus: focus && root.contains(focus) ? focus.dataset.historyFocus ?? null : null,
    scroll,
  }
  if (canUpdateEntry) {
    visitedViews.delete(snapshot.key)
    router.options.history.replace(path, { scroll: state.scroll, craftflowView: snapshot })
  } else {
    // 浏览器已移到相邻条目，此时内存快照补充该页最新的面板位置。
    visitedViews.delete(snapshot.key)
    visitedViews.set(snapshot.key, snapshot)
    if (visitedViews.size > 50) visitedViews.delete(visitedViews.keys().next().value!)
  }
  activeView = snapshot
}

function findHistoryView(path: string, marker: 'historyView' | 'historyReady') {
  const selector = marker === 'historyView' ? '[data-history-view]' : '[data-history-ready]'
  return [...document.querySelectorAll<HTMLElement>(selector)].find(element => element.dataset[marker] === path)
}

export function historyView(path: string) {
  return findHistoryView(path, 'historyReady')
}

export function savedHistoryView(state: HistoryState, path: string, userId: string | null, role: string | null) {
  const snapshot = state.craftflowView as SavedHistoryView | undefined
  if (!snapshot?.key || snapshot.path !== path || snapshot.userId !== userId || snapshot.role !== role) return undefined
  return visitedViews.get(snapshot.key) ?? snapshot
}

/** 恢复窄屏和双栏中的独立滚动区域，再聚焦原控件。 */
export function restoreHistoryView(root: HTMLElement, snapshot: SavedHistoryView) {
  for (const element of root.querySelectorAll<HTMLElement>('[data-history-scroll]')) {
    const position = snapshot.scroll.find(item => item.name === element.dataset.historyScroll)
    if (position) element.scrollTo({ left: position.left, top: position.top, behavior: 'instant' })
  }
  if (!snapshot.focus) return
  const trigger = [...root.querySelectorAll<HTMLElement>('[data-history-focus]')]
    .find(element => element.dataset.historyFocus === snapshot.focus)
  if (trigger?.getClientRects().length) {
    trigger.focus({ preventScroll: true })
    return
  }
  const heading = root.querySelector<HTMLElement>('h1') ?? root.querySelector<HTMLElement>('h2') ??
    root.closest('main')?.querySelector<HTMLElement>('h1, h2')
  if (heading) {
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }
}
