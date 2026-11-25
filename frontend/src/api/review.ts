import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { PageVO } from '@/types/creator'
import type { CreatorReviewVO, OrderReviewVO, ReviewReportDetailVO, ReviewReportVO } from '@/types/review'
import type { ReviewReportDecision } from '@/types/report'

const get = async <T>(path: string, params?: object) => (await request.get<ApiResult<T>>(path, { params })).data.data
export const getOrderReview = (id: string) => get<OrderReviewVO>(`/orders/${id}/review`)
export async function createOrderReview(id: string, input: { rating: number; content: string; imageIds: string[] }) {
  return (await request.post<ApiResult<OrderReviewVO>>(`/orders/${id}/reviews`, input)).data.data
}
export const getCreatorReviews = (id: string, page = 1) => get<PageVO<CreatorReviewVO>>(`/creators/${id}/reviews`, { page })
export async function uploadReviewImage(file: File) {
  const form = new FormData(); form.append('file', file)
  return (await request.post<ApiResult<{ id: string; url: string; expiresAt: string }>>('/work-comment-images', form, { timeout: 60_000 })).data.data
}
export async function reportReview(id: string, input: { reasonCode: string; description: string; imageIds: string[] }) {
  return (await request.post<ApiResult<ReviewReportVO>>(`/reviews/${id}/reports`, input)).data.data
}
export const getReviewReportsForActor = (id: string) => get<ReviewReportVO[]>(`/reviews/${id}/reports`)
export async function addReviewReportEvidence(id: string, input: { content: string; imageIds: string[] }) {
  return (await request.post<ApiResult<ReviewReportDetailVO>>(`/review-reports/${id}/evidence`, input)).data.data
}
export const getReviewReports = (status = 'PENDING', page = 1) => get<PageVO<ReviewReportVO>>('/admin/review-reports', { status, page })
export const getReviewReport = (id: string) => get<ReviewReportDetailVO>(`/review-reports/${id}`)
export const getReviewImage = (id: string) => get<{ id: string; url: string; expiresAt: string }>(`/review-images/${id}`)
export async function decideReviewReport(id: string, decision: ReviewReportDecision, reason: string, expectedHistoryId: string) {
  return (await request.put<ApiResult<ReviewReportVO>>(`/admin/review-reports/${id}/decision`, { decision, reason, expectedHistoryId })).data.data
}
