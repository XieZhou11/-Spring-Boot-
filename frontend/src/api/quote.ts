import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { ImageVO, PageVO } from '@/types/creator'
import type { AwardDTO, OrderNoStartRefundDTO, OrderPaymentDTO, OrderProgressDTO, OrderShipmentDTO, OrderSkipDTO, OrderTrackingDTO, OrderVO, QuoteComparisonVO, QuoteDTO, QuoteQuotaVO, QuoteVO } from '@/types/quote'

async function get<T>(path: string, params?: object) { return (await request.get<ApiResult<T>>(path, { params })).data.data }
/** 请求键由调用页面持有，网络重试不得在请求层重新生成。 */
export const createQuote = async (id: string, data: QuoteDTO) => (await request.post<ApiResult<QuoteVO>>(`/custom-requests/${id}/quotes`, data)).data.data
export const getRequestQuotes = (id: string, params: object = {}) => get<PageVO<QuoteVO>>(`/custom-requests/${id}/quotes`, params)
export const getMyQuotes = (params: object) => get<PageVO<QuoteVO>>('/me/quotes', params)
export const getQuote = (id: string) => get<QuoteVO>(`/quotes/${id}`)
export const getQuoteQuota = () => get<QuoteQuotaVO>('/me/quote-quota')
export const getQuoteComparison = (id: string, sort: string) => get<QuoteComparisonVO>(`/custom-requests/${id}/quote-comparison`, { sort })
export const withdrawQuote = async (id: string) => (await request.put<ApiResult<QuoteVO>>(`/quotes/${id}/withdrawal`)).data.data
export const awardQuote = async (id: string, data: AwardDTO) => (await request.put<ApiResult<OrderVO>>(`/custom-requests/${id}/award`, data)).data.data
export const getOrders = (params: object) => get<PageVO<OrderVO>>('/me/orders', params)
export const getOrder = (id: string) => get<OrderVO>(`/orders/${id}`)
export const cancelOrder = async (id: string) => (await request.put<ApiResult<OrderVO>>(`/orders/${id}/cancellation`)).data.data
/** 创作者申请公开本次定制成品；服务端按订单状态和身份核验。 */
export const requestPublicationConsent = async (id: string) => (await request.post<ApiResult<OrderVO>>(`/orders/${id}/publication-consent`)).data.data
/** 买家通过按钮明确同意或拒绝，不以会话内容作为授权。 */
export const respondPublicationConsent = async (id: string, decision: 'APPROVED' | 'REJECTED') => (await request.put<ApiResult<OrderVO>>(`/orders/${id}/publication-consent`, { decision })).data.data
/** 同订单重试必须复用首次确认内容，由服务端返回原有流水。 */
export const payOrder = async (id: string, data: OrderPaymentDTO) => (await request.put<ApiResult<OrderVO>>(`/orders/${id}/payment`, data)).data.data
/** 履约始终由服务端核验参与方、顺序与当前状态，页面只提交原始输入。 */
async function fulfill(id: string, path: string, data?: object) { return (await request.put<ApiResult<OrderVO>>(`/orders/${id}/${path}`, data)).data.data }
export const startProduction = (id: string) => fulfill(id, 'production-start')
export const checkInProgress = (id: string, nodeId: string, data: OrderProgressDTO) => fulfill(id, `progress-nodes/${nodeId}/check-in`, data)
export const skipProgress = (id: string, nodeId: string, data: OrderSkipDTO) => fulfill(id, `progress-nodes/${nodeId}/skip`, data)
export const supplementProgress = async (id: string, nodeId: string, data: OrderProgressDTO) => (await request.post<ApiResult<OrderVO>>(`/orders/${id}/progress-nodes/${nodeId}/supplements`, data)).data.data
export const shipOrder = (id: string, data: OrderShipmentDTO) => fulfill(id, 'shipment', data)
export const correctTracking = (id: string, data: OrderTrackingDTO) => fulfill(id, 'shipment/tracking-number', data)
export const confirmReceipt = (id: string) => fulfill(id, 'receipt')
export const requestNoStartRefund = (id: string, data: OrderNoStartRefundDTO) => fulfill(id, 'no-start-refund', data)
/** 进度和退款图片使用各自订单用途上传，不能借用报价图片。 */
export async function uploadOrderImage(orderId: string, file: File, scope: 'progress' | 'refund') {
  const data = new FormData(); data.append('file', file)
  return (await request.post<ApiResult<ImageVO>>(`/orders/${orderId}/${scope === 'progress' ? 'progress-images' : 'refund-images'}`, data, { timeout: 60_000 })).data.data
}
export async function uploadQuoteImage(file: File) {
  const data = new FormData(); data.append('file', file)
  return (await request.post<ApiResult<ImageVO>>('/quote-images', data, { timeout: 60_000 })).data.data
}
