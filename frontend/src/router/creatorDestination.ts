import { shallowRef, watch } from 'vue'
import type { Router } from 'vue-router'
import { safeRedirect } from '@/utils/auth'
import { invalidPathResource } from './routeFeedback'

const storageKey = 'craftflow-creator-destination'
const pending = shallowRef<{ userId: string; path: string }>()

/** 认证可能跨刷新完成，续接位置只绑定当前标签页中的同一账号。 */
export function trackCreatorDestination(userId: () => string | undefined) {
  watch(userId, (next, previous) => {
    if (!next || previous) {
      clearCreatorDestination()
      return
    }
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
      if (saved && typeof saved === 'object' && 'userId' in saved && saved.userId === next && 'path' in saved && typeof saved.path === 'string')
        pending.value = { userId: next, path: saved.path }
    } catch { /* 浏览器存储不可用时继续使用内存。 */ }
  }, { flush: 'sync' })
}

export function creatorDestination(router: Router, userId: string | undefined) {
  if (!userId || pending.value?.userId !== userId) return undefined
  const path = safeRedirect(pending.value.path)
  const route = router.resolve(path)
  return route.meta.requiresCreator && route.fullPath === path && !invalidPathResource(route) ? path : undefined
}

export function rememberCreatorDestination(userId: string, path: string) {
  pending.value = { userId, path }
  try { sessionStorage.setItem(storageKey, JSON.stringify(pending.value)) } catch { /* 本次使用仍可续接。 */ }
}

export function clearCreatorDestination() {
  pending.value = undefined
  try { sessionStorage.removeItem(storageKey) } catch { /* 不阻断导航。 */ }
}
