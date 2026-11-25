import type { LocationQuery } from 'vue-router'
import { orderStatus } from './quote'

export type OrderSide = 'BUYER' | 'CREATOR'

/** 只保留服务端支持的订单列表筛选，让列表、详情和返回链接共享同一口径。 */
export function getOrderListQuery(
  query: LocationQuery = {},
  defaultSide: OrderSide = 'BUYER',
): { side?: OrderSide; status?: string; page?: string } {
  const explicitSide = query.side === 'BUYER' || query.side === 'CREATOR' ? query.side : undefined
  const side = explicitSide ?? (defaultSide === 'CREATOR' ? defaultSide : undefined)
  const status = typeof query.status === 'string' && Object.hasOwn(orderStatus, query.status) ? query.status : undefined
  const page = typeof query.page === 'string' && /^\d+$/.test(query.page) ? Number(query.page) : 1
  return {
    side,
    status,
    page: page > 1 && page <= 1_000_000 ? String(page) : undefined,
  }
}
