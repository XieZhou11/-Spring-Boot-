/** 统一列表、方案详情及会话中的业务状态文案。 */
export const quoteStatus: Record<string, string> = { ACTIVE: '有效报价', AWARDED: '已中标', LOST: '未中标', EXPIRED: '已失效' }
export const orderStatus: Record<string, string> = { PENDING_PAY: '待付款', PAID: '待开工', CANCELLED: '已取消', IN_PRODUCTION: '制作中', PENDING_SHIP: '待发货', SHIPPED: '已发货', COMPLETED: '已完成', AFTER_SALE: '售后中', REFUNDED: '已退款' }
export const progressNodeName: Record<string, string> = { MATERIAL: '备料', SAMPLE: '打样打版', MAKING: '制作', QC: '质检', SHIPPING: '包装发货' }
export const progressNodeStatus: Record<string, string> = { NOT_STARTED: '未开始', UNLOCKED: '已解锁', CHECKED: '已打卡', SKIPPED: '已跳过' }
export const settlementStatus: Record<string, string> = { PENDING: '待结算', SETTLED: '已结算', CANCELLED: '已取消' }
export function invalidQuoteReason(reason: string | null) {
  if (!reason) return ''
  return ({ WITHDRAWN: '创作者主动撤回', WITHDRAW: '创作者主动撤回', TIMEOUT: '报价已到期', EXPIRED: '报价已到期', REQUEST_CLOSED: '需求已关闭', REQUEST_EXPIRED: '需求已过期' } as Record<string, string>)[reason] || reason
}
/** 状态历史保留服务端原因，已知枚举在页面转换为业务文案。 */
export function orderReason(reason: string | null) {
  if (!reason) return ''
  return ({ TIMEOUT: '创建后 24 小时未付款，订单已自动取消。', BUYER_CANCELLED: '买家取消未付款订单。', AWARDED: '买家选定报价并创建订单。', SIMULATED_PAYMENT: '买家完成模拟支付。', PRODUCTION_STARTED: '创作者确认开工，首节点已解锁。', ALL_PRODUCTION_NODES_HANDLED: '前四节点已处理，等待包装发货。', SHIPMENT_CONFIRMED: '包装图文和运单号已提交，订单已发货。', BUYER_RECEIPT: '买家确认收货。', AUTO_RECEIPT: '发货满七天，系统自动确认收货。', NO_START_TIMEOUT: '支付满48小时仍未开工，系统执行无责全额退款。' } as Record<string, string>)[reason] || reason
}
