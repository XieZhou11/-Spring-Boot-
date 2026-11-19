import type { OrderNoStartRefundDTO, OrderProgressDTO, OrderShipmentDTO, OrderSkipDTO, OrderTrackingDTO, OrderVO } from '@/types/quote'

/** 一个订单同时只保留一个未核验的写操作，禁止未知结果下另起请求键。 */
export type FulfillmentAttempt =
  | { kind: 'start' }
  | { kind: 'receipt' }
  | { kind: 'check-in' | 'supplement'; nodeId: string; input: OrderProgressDTO }
  | { kind: 'skip'; nodeId: string; input: OrderSkipDTO }
  | { kind: 'shipment'; nodeId: string; input: OrderShipmentDTO }
  | { kind: 'tracking'; input: OrderTrackingDTO }
  | { kind: 'refund'; input: OrderNoStartRefundDTO }

const prefix = 'order-fulfillment:'
const key = (userId: string, orderId: string) => `${prefix}${userId}:${orderId}`
const sameImages = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)

/** 仅保存正文、图片编号和运单输入；地址、收款资料与签名URL绝不进入存储。 */
export function saveFulfillmentAttempt(userId: string, orderId: string, attempt: FulfillmentAttempt) {
  sessionStorage.setItem(key(userId, orderId), JSON.stringify(attempt))
}

/** 恢复时逐字段构造白名单输入，损坏的本地内容不能直接变成业务请求。 */
export function readFulfillmentAttempt(userId: string, orderId: string): FulfillmentAttempt | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(userId, orderId)) || 'null')
    if (!value || typeof value.kind !== 'string') return
    if (value.kind === 'start' || value.kind === 'receipt') return { kind: value.kind }
    const input = value.input
    if (!input || typeof input !== 'object') return
    if (value.kind === 'refund') {
      if (typeof input.description !== 'string' || !Array.isArray(input.imageIds) || !input.imageIds.every((id: unknown) => typeof id === 'string')) return
      return { kind: 'refund', input: { description: input.description, imageIds: [...input.imageIds] } }
    }
    if (typeof input.requestKey !== 'string' || !input.requestKey) return
    if (value.kind === 'tracking') {
      if (typeof input.expectedTrackingNo !== 'string' || typeof input.trackingNo !== 'string') return
      return { kind: 'tracking', input: { requestKey: input.requestKey, expectedTrackingNo: input.expectedTrackingNo, trackingNo: input.trackingNo } }
    }
    if (!['check-in', 'skip', 'supplement', 'shipment'].includes(value.kind) || typeof value.nodeId !== 'string' || typeof input.content !== 'string' || !Array.isArray(input.imageIds) || !input.imageIds.every((id: unknown) => typeof id === 'string')) return
    const graph = { requestKey: input.requestKey, content: input.content, imageIds: [...input.imageIds] }
    if (value.kind === 'skip') return typeof input.skipReason === 'string' ? { kind: 'skip', nodeId: value.nodeId, input: { ...graph, skipReason: input.skipReason } } : undefined
    if (value.kind === 'shipment') return typeof input.trackingNo === 'string' ? { kind: 'shipment', nodeId: value.nodeId, input: { ...graph, trackingNo: input.trackingNo } } : undefined
    return { kind: value.kind, nodeId: value.nodeId, input: graph }
  } catch { /* 无效存储不作为重试依据，服务端状态仍从订单详情核验。 */ }
}

/** 只用原请求键及原内容，或自然单例的固定事实核验；不能拿最新状态猜追加成功。 */
export function fulfillmentApplied(order: OrderVO, attempt: FulfillmentAttempt): boolean {
  if (attempt.kind === 'start') return !!order.startedAt
  if (attempt.kind === 'receipt') return !!order.originalCompletedAt
  if (attempt.kind === 'refund') return !!order.noStartRefund && order.noStartRefund.description === attempt.input.description && sameImages(order.noStartRefund.imageIds, attempt.input.imageIds)
  if (attempt.kind === 'tracking') return !!order.trackingHistory?.some(item => item.requestKey === attempt.input.requestKey && item.oldTrackingNo === attempt.input.expectedTrackingNo && item.newTrackingNo === attempt.input.trackingNo)
  if (!('nodeId' in attempt)) return false
  if (attempt.kind === 'shipment') {
    // 更正历史按服务端提交顺序返回，首条原值还原首次发货输入，不拿当前单号猜原提交。
    const originalTrackingNo = order.trackingHistory?.[0]?.oldTrackingNo || order.trackingNo
    if (!order.shippedAt || originalTrackingNo !== attempt.input.trackingNo) return false
  }
  const recordType = attempt.kind === 'supplement' ? 'SUPPLEMENT' : attempt.kind === 'skip' ? 'SKIP' : 'CHECKIN'
  return !!order.progressNodes?.find(node => node.id === attempt.nodeId)?.records?.some(record => record.requestKey === attempt.input.requestKey && record.recordType === recordType && (record.content || '') === attempt.input.content && sameImages(record.imageIds, attempt.input.imageIds) && (record.skipReason || '') === (attempt.kind === 'skip' ? attempt.input.skipReason : ''))
}

/** 删除失败不会把已确认成功误报为失败，旧标记下次仍须精确核验。 */
export function clearFulfillmentAttempt(userId: string, orderId: string) {
  try { sessionStorage.removeItem(key(userId, orderId)) } catch { /* 不阻断成功结果展示。 */ }
}

/** 退出及账号替换时清理该账号留存的履约输入。 */
export function clearUserFulfillmentAttempts(userId?: string) {
  if (!userId) return
  try {
    for (const storedKey of Object.keys(sessionStorage)) if (storedKey.startsWith(`${prefix}${userId}:`)) {
      try { sessionStorage.removeItem(storedKey) } catch { /* 单条失败继续清理其他记录。 */ }
    }
  } catch { /* 浏览器存储不可用不能阻断退出。 */ }
}

export const fulfillmentActionName: Record<FulfillmentAttempt['kind'], string> = {
  start: '确认开工', 'check-in': '提交打卡', skip: '跳过打样', supplement: '追加补充', shipment: '确认发货', tracking: '更正运单号', receipt: '确认收货', refund: '申请未开工全额退款',
}
