import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { ImageVO, PageVO } from '@/types/creator'
import type { ChatMessageVO } from '@/types/customRequest'
import type { AdminRefundDetailVO, AdminRefundQueueVO, RefundApplicationVO, RefundCreateDTO, RefundDecisionDTO, RefundEvidenceDTO, RefundEvidencePageVO } from '@/types/refund'

async function get<T>(path: string, params?: object) { return (await request.get<ApiResult<T>>(path, { params })).data.data }
/** 申请和补证的请求键由页面保留，网络恢复不生成新键。 */
export const createRefund = async (orderId: string, input: RefundCreateDTO) => (await request.post<ApiResult<RefundApplicationVO>>(`/orders/${orderId}/refund-applications`, input)).data.data
export const getRefunds = (orderId: string, params: object = {}) => get<PageVO<RefundApplicationVO>>(`/orders/${orderId}/refund-applications`, params)
export const getRefund = (id: string) => get<RefundApplicationVO>(`/refund-applications/${id}`)
export const getRefundEvidence = (id: string, params: object = {}, admin = false) => get<RefundEvidencePageVO>(`${admin ? '/admin' : ''}/refund-applications/${id}/evidence`, params)
export const addRefundEvidence = async (id: string, input: RefundEvidenceDTO) => (await request.post<ApiResult<RefundApplicationVO>>(`/refund-applications/${id}/evidence`, input)).data.data
export const withdrawRefund = async (id: string) => (await request.put<ApiResult<RefundApplicationVO>>(`/refund-applications/${id}/withdrawal`)).data.data
export const getAdminRefunds = (params: object) => get<PageVO<AdminRefundQueueVO>>('/admin/refund-applications', params)
export const getAdminRefund = (id: string) => get<AdminRefundDetailVO>(`/admin/refund-applications/${id}`)
export const decideRefund = async (id: string, input: RefundDecisionDTO) => (await request.put<ApiResult<AdminRefundDetailVO>>(`/admin/refund-applications/${id}/decision`, { ...input, returnTrackingNo: input.returnTrackingNo || null, noReturnBasis: input.noReturnBasis || null })).data.data
/** 管理员只读聊天不调用发送/已读接口，图片续签亦按当前售后上下文重新校验。 */
export const getAdminRefundMessages = (id: string, params: object = {}) => get<{ items: ChatMessageVO[]; hasMore: boolean }>(`/admin/refund-applications/${id}/messages`, params)
export const getAdminRefundImage = (id: string, fileId: string) => get<ImageVO>(`/admin/refund-applications/${id}/images/${fileId}`)
