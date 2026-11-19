import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { ImageVO, PageVO } from '@/types/creator'
import type { AwardDTO, OrderPaymentDTO, OrderVO, QuoteComparisonVO, QuoteDTO, QuoteQuotaVO, QuoteVO } from '@/types/quote'

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
/** 同订单重试必须复用首次确认内容，由服务端返回原有流水。 */
export const payOrder = async (id: string, data: OrderPaymentDTO) => (await request.put<ApiResult<OrderVO>>(`/orders/${id}/payment`, data)).data.data
export async function uploadQuoteImage(file: File) {
  const data = new FormData(); data.append('file', file)
  return (await request.post<ApiResult<ImageVO>>('/quote-images', data, { timeout: 60_000 })).data.data
}
