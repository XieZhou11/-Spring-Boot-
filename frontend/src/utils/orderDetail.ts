import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'

export const orderDetailLabels = {
  address: '收货地址快照',
  agreement: '锁定的合作方案',
  payment: '支付记录',
  review: '订单评价',
  refund: '售后与退款',
  settlement: '结算信息',
  request: '需求快照',
  publication: '定制成品公开授权',
  history: '订单历史',
} as const

export type OrderDetailSection = keyof typeof orderDetailLabels

export function isOrderDetailSection(value: unknown): value is OrderDetailSection {
  return typeof value === 'string' && Object.hasOwn(orderDetailLabels, value)
}

/** 只有同一笔订单的原页面确实在上一个历史条目时才执行后退。 */
export function hasOrderReturn(router: Router, route: RouteLocationNormalizedLoaded, orderId: string) {
  const { back, current, orderReturnTo } = window.history.state ?? {}
  if (current !== route.fullPath || typeof back !== 'string' || !back.startsWith('/orders/') || orderReturnTo !== back) return false
  const source = router.resolve(back)
  return (source.name === 'order-detail' || source.name === 'order-detail-section') && source.params.id === orderId
}
