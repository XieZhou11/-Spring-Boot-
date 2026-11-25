import type { WorkContent, WorkStatus } from '@/types/work'

export const workStatusLabels: Record<WorkStatus, string> = { DRAFT: '草稿', PENDING: '待审核', ONLINE: '已上架', REJECTED: '已驳回', OFFLINE: '已下架' }
/** 发布、交易设置和恢复直购使用相同的十进制售价校验。 */
export function validStockPrice(value: string | null) {
  return !!value && /^(?:[1-9]\d{0,4}|0)(?:\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 99999
}
/** 不用浮点数处理金额，补齐小数以供展示。 */
export function priceLabel(value: string | null) {
  if (!value) return '—'
  const [integer, decimal = ''] = String(value).split('.')
  return `${integer}.${decimal.padEnd(2, '0')}`
}
export function emptyWork(): WorkContent {
  return { title: '', categoryId: null, mainImageIds: [], specificationImageIds: [], material: '', specification: '', description: '', processDescription: '', saleEnabled: false, customEnabled: false, stockPrice: null, customReferenceDays: null, sourceOrderId: null }
}
/** 只发送允许编辑的字段，避免把状态、库存等响应字段写回服务端。 */
export function workContent(work: WorkContent): WorkContent {
  return { title: work.title || '', categoryId: work.categoryId, mainImageIds: [...work.mainImageIds], specificationImageIds: [...work.specificationImageIds], material: work.material || '', specification: work.specification || '', description: work.description || '', processDescription: work.processDescription || '', saleEnabled: work.saleEnabled, customEnabled: work.customEnabled, stockPrice: work.saleEnabled ? work.stockPrice : null, customReferenceDays: work.customEnabled ? work.customReferenceDays : null, sourceOrderId: work.sourceOrderId }
}
