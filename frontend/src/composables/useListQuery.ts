import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** 从分页链接恢复已应用条件，限制接口可接收的页码和状态。 */
export function useListQuery<T extends string = string>(statuses?: Readonly<Record<T, string>>, pageKey = 'page') {
  const route = useRoute()
  const router = useRouter()
  const page = computed(() => {
    const raw = route.query[pageKey]
    const value = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : 1
    return value > 1 && value <= 1_000_000 ? value : 1
  })
  const status = computed<T | ''>(() => {
    const raw = route.query.status
    return statuses && typeof raw === 'string' && Object.hasOwn(statuses, raw) ? raw as T : ''
  })

  function target(next: number, filter: T | '') {
    const query = { ...route.query, [pageKey]: next > 1 ? String(next) : undefined }
    return {
      path: route.path,
      hash: route.hash,
      query: statuses ? { ...query, status: filter || undefined } : query,
    }
  }

  function changePage(next: number) {
    return router.push(target(next, status.value))
  }

  async function changeStatus(event: Event) {
    const select = event.currentTarget as HTMLSelectElement
    const raw = select.value
    const filter = statuses && Object.hasOwn(statuses, raw) ? raw as T : ''
    await selectStatus(filter)
    // 导航失败时恢复仍在地址栏生效的条件。
    select.value = status.value
  }

  function selectStatus(filter: T | '') {
    return router.push(target(1, filter))
  }

  /** 列表缩短时替换无效页，避免用户后退时重新进入空页。 */
  function replaceLastPage(result: { total: number; size: number }, requestedPage: number) {
    const last = Math.max(1, Math.ceil(result.total / result.size))
    if (requestedPage <= last) return false
    void router.replace(target(last, status.value))
    return true
  }

  return { page, status, changePage, changeStatus, selectStatus, replaceLastPage }
}
