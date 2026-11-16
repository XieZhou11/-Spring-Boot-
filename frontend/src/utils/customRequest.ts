import type { RequestContent } from '@/types/customRequest'
/** 独立抽取正文，禁止把服务端权限等响应字段发回。 */
export function requestContent(value?: Partial<RequestContent>): RequestContent {
  return { title: value?.title || '', categoryId: value?.categoryId || null, purpose: value?.purpose || '', materialPreference: value?.materialPreference || '', specification: value?.specification || '', budgetMin: value?.budgetMin || null, budgetMax: value?.budgetMax || null, expectedShipDate: value?.expectedShipDate || null, description: value?.description || '', referenceImageIds: [...(value?.referenceImageIds || [])], visibility: value?.visibility || 'PUBLIC', invitedCreatorId: value?.invitedCreatorId || null, sourceWorkId: value?.sourceWorkId || null }
}
export const requestStatus: Record<string, string> = { DRAFT: '草稿', OPEN: '待响应', QUOTING: '报价中', AWARDED: '已定标', IN_TRADE: '交易进行中', COMPLETED: '已完成', CLOSED: '已关闭', EXPIRED: '已过期' }
export const countLabel = (value: number) => value > 99 ? '99+' : String(value)
