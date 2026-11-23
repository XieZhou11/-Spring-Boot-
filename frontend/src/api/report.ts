import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { PageVO, ImageVO } from '@/types/creator'
import type { ContentReportVO, ContentReportDetailVO, ContentReportStatus, ContentReportTargetType, ContentReportDecision, ReportInput } from '@/types/report'
import type { ReviewReportVO } from '@/types/review'

const get = async <T>(path: string, params?: object) => (await request.get<ApiResult<T>>(path, { params })).data.data

/** 提交作品举报。 */
export async function reportWork(id: string, input: ReportInput) {
  return (await request.post<ApiResult<ContentReportVO>>(`/works/${id}/reports`, input)).data.data
}
/** 提交作品评论举报。 */
export async function reportComment(id: string, input: ReportInput) {
  return (await request.post<ApiResult<ContentReportVO>>(`/work-comments/${id}/reports`, input)).data.data
}
/** 提交创作者主页举报。 */
export async function reportCreatorProfile(id: string, input: ReportInput) {
  return (await request.post<ApiResult<ContentReportVO>>(`/creators/${id}/reports`, input)).data.data
}
/** 举报详情。 */
export const getReport = (id: string) => get<ContentReportDetailVO>(`/reports/${id}`)
/** 举报人补证或被处理人异议。 */
export async function addReportEvidence(id: string, input: { content: string; imageIds: string[] }) {
  return (await request.post<ApiResult<ContentReportDetailVO>>(`/reports/${id}/evidence`, input)).data.data
}
/** 本人全部类型举报列表。 */
export const getMyReports = (page = 1) => get<PageVO<ContentReportVO>>('/me/reports', { page })
/** 管理员举报队列，可按类型与状态筛选。 */
export const getAdminReports = (status: ContentReportStatus | 'ALL' = 'PENDING', type: ContentReportTargetType | 'ALL' = 'ALL', page = 1) =>
  get<PageVO<ContentReportVO>>('/admin/reports', { status, type, page })
/** 管理员处置或更正。 */
export async function decideContentReport(id: string, decision: ContentReportDecision, reason: string) {
  return (await request.put<ApiResult<ContentReportVO>>(`/admin/reports/${id}/decision`, { decision, reason })).data.data
}
/** 举报证据图片签名。 */
export const getReportImage = (id: string) => get<ImageVO>(`/report-images/${id}`)

export type { ReviewReportVO }
