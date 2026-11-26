import { shallowRef } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'

/** 应用外壳随入口加载，业务页面未挂载时也能提供导航反馈。 */
export const routeFeedback = shallowRef<{ path: string; kind: 'connection' | 'resource' }>()

export function validResourceId(id: unknown): id is string {
  return typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id) && (id.length < 19 || id <= '9223372036854775807')
}

export function invalidPathResource(route: Pick<RouteLocationNormalized, 'matched' | 'params'>) {
  return route.matched.some(record => /(^|\/):id(\/|$)/.test(record.path)) && !validResourceId(route.params.id)
}
