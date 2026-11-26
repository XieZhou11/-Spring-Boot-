import type { RequestContent } from '@/types/customRequest'
/** 独立抽取正文，禁止把服务端权限等响应字段发回。 */
export function requestContent(value?: Partial<RequestContent>): RequestContent {
  return { title: value?.title || '', categoryId: value?.categoryId || null, purpose: value?.purpose || '', materialPreference: value?.materialPreference || '', specification: value?.specification || '', budgetMin: value?.budgetMin || null, budgetMax: value?.budgetMax || null, expectedShipDate: value?.expectedShipDate || null, description: value?.description || '', referenceImageIds: [...(value?.referenceImageIds || [])], visibility: value?.visibility || 'PUBLIC', invitedCreatorId: value?.invitedCreatorId || null, sourceWorkId: value?.sourceWorkId || null }
}
export const requestStatus: Record<string, string> = { DRAFT: '草稿', OPEN: '待响应', QUOTING: '报价中', AWARDED: '已定标', IN_TRADE: '交易进行中', COMPLETED: '已完成', CLOSED: '已关闭', EXPIRED: '已过期' }
export const countLabel = (value: number) => value > 99 ? '99+' : String(value)

export const requestListPaths = { mine: '/my-requests', hall: '/requests', invitations: '/creator/invitations' } as const
const requestReturnPaths = [...Object.values(requestListPaths), '/creator/quotes'] as readonly string[]

/** 回跳只接受现有需求列表路径，保留来源页的筛选与页码。 */
export function parseRequestListReturn(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) return
  const [path = ''] = value.split(/[?#]/, 1)
  if (requestReturnPaths.includes(path)) return value
}

/** 订单由买家定标时只可携带其本人需求列表的来路。 */
export function buyerRequestListReturn(value: unknown): string | undefined {
  const source = parseRequestListReturn(value)
  return source?.split(/[?#]/, 1)[0] === requestListPaths.mine ? source : undefined
}

export function requestListReturn(value: unknown): string {
  return parseRequestListReturn(value) ?? requestListPaths.mine
}

/** 草稿可只有一侧预算，按已保存的金额展示。 */
export function requestBudget({ budgetMin, budgetMax }: Pick<RequestContent, 'budgetMin' | 'budgetMax'>) {
  if (budgetMin && budgetMax) return `¥ ${budgetMin} – ${budgetMax}`
  if (budgetMin) return `¥ ${budgetMin} 起`
  if (budgetMax) return `最高 ¥ ${budgetMax}`
  return '预算待填写'
}
