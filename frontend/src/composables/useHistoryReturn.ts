import { useRoute, useRouter, type RouteLocationRaw, type RouteLocationResolved } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/** 返回仅消费同一身份显式打开详情时留下的相邻站内记录。 */
export function useHistoryReturn() {
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()

  function entry(to: RouteLocationRaw): RouteLocationRaw {
    const target = router.resolve(to)
    const location = typeof to === 'string' ? { path: target.path, query: target.query, hash: target.hash } : to
    return {
      ...location,
      state: {
        ...location.state,
        craftflowReturnFrom: route.fullPath,
        craftflowReturnTo: target.fullPath,
        craftflowReturnUser: auth.session?.userId ?? null,
        craftflowReturnRole: auth.session?.activeRole ?? null,
      },
    }
  }

  function source(accept?: (location: RouteLocationResolved) => boolean): RouteLocationResolved | undefined {
    const state = router.options.history.state
    const from = state.craftflowReturnFrom
    if (state.current !== route.fullPath || state.craftflowReturnTo !== route.fullPath ||
        typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || state.back !== from ||
        state.craftflowReturnUser !== (auth.session?.userId ?? null) ||
        state.craftflowReturnRole !== (auth.session?.activeRole ?? null)) return undefined

    const location = router.resolve(from)
    return location.matched.length && (!accept || accept(location)) ? location : undefined
  }

  return { entry, source }
}
