/** 统一列表、方案详情及会话中的业务状态文案。 */
export const quoteStatus: Record<string, string> = { ACTIVE: '有效报价', AWARDED: '已中标', LOST: '未中标', EXPIRED: '已失效' }
export const orderStatus: Record<string, string> = { PENDING_PAY: '待付款', CANCELLED: '已取消', IN_PRODUCTION: '制作中', PENDING_SHIPMENT: '待发货', SHIPPED: '已发货', COMPLETED: '已完成', REFUNDED: '已退款' }
export function invalidQuoteReason(reason: string | null) {
  if (!reason) return ''
  return ({ WITHDRAWN: '创作者主动撤回', WITHDRAW: '创作者主动撤回', TIMEOUT: '报价已到期', EXPIRED: '报价已到期', REQUEST_CLOSED: '需求已关闭', REQUEST_EXPIRED: '需求已过期' } as Record<string, string>)[reason] || reason
}
/** 状态历史保留服务端原因，已知枚举在页面转换为业务文案。 */
export function orderReason(reason: string | null) {
  if (!reason) return ''
  return ({ TIMEOUT: '创建后 24 小时未付款，订单已自动取消。', BUYER_CANCELLED: '买家取消未付款订单。', AWARDED: '买家选定报价并创建订单。' } as Record<string, string>)[reason] || reason
}
