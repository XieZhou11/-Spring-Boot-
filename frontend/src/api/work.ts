import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { ImageVO, PageVO } from '@/types/creator'
import type { CreatorPublicVO, PublicationQuotaVO, WorkContent, WorkHistoryVO, WorkQuery, WorkVO } from '@/types/work'

/** 全部作品请求复用会话、CSRF 与统一错误处理。 */
async function get<T>(path: string, params?: object) {
  return (await request.get<ApiResult<T>>(path, { params })).data.data
}
const scope = (admin = false) => admin ? '/admin/works' : '/me/works'
export const getWorks = (params: WorkQuery) => get<PageVO<WorkVO>>('/works', params)
export const getWork = (id: string) => get<WorkVO>(`/works/${id}`)
export const getCreator = (id: string) => get<CreatorPublicVO>(`/creators/${id}`)
export const getManagedWorks = (params: WorkQuery, admin = false) => get<PageVO<WorkVO>>(scope(admin), { ...params, status: params.status || 'ALL' })
export const getManagedWork = (id: string, admin = false) => get<WorkVO>(`${scope(admin)}/${id}`)
export const getWorkHistory = (id: string, page = 1, admin = false) => get<PageVO<WorkHistoryVO>>(`${scope(admin)}/${id}/history`, { page })
export const getPublicationQuota = () => get<PublicationQuotaVO>('/me/work-publication-quota')
export const getWorkImage = (id: string) => get<ImageVO>(`/work-images/${id}`)
export async function uploadWorkImage(file: File) {
  const data = new FormData()
  data.append('file', file)
  return (await request.post<ApiResult<ImageVO>>('/work-images', data, { timeout: 60_000 })).data.data
}
export async function createWork(content: WorkContent, requestKey: string) {
  return (await request.post<ApiResult<WorkVO>>('/me/works', { ...content, requestKey })).data.data
}
export async function saveWork(id: string, content: WorkContent, version: string) {
  return (await request.put<ApiResult<WorkVO>>(`/me/works/${id}`, { ...content, version })).data.data
}
export async function submitWork(id: string, content: WorkContent, version: string) {
  return (await request.put<ApiResult<WorkVO>>(`/me/works/${id}/submission`, { ...content, version })).data.data
}
export async function withdrawWork(id: string, version: string) {
  return (await request.put<ApiResult<WorkVO>>(`/me/works/${id}/withdrawal`, { version })).data.data
}
export async function deleteWork(id: string, version: string) {
  await request.delete(`/me/works/${id}`, { params: { version } })
}
export async function updateTrading(id: string, input: Pick<WorkVO, 'version' | 'saleEnabled' | 'customEnabled' | 'stockPrice' | 'customReferenceDays'>) {
  return (await request.patch<ApiResult<WorkVO>>(`/me/works/${id}/trading-settings`, input)).data.data
}
export async function offlineWork(id: string, version: string, admin = false, reason = '') {
  return (await request.put<ApiResult<WorkVO>>(`${scope(admin)}/${id}/publication`, { version, reason })).data.data
}
export async function reviewWork(id: string, version: string, decision: 'APPROVED' | 'REJECTED', reason: string) {
  return (await request.put<ApiResult<WorkVO>>(`/admin/works/${id}/review`, { version, decision, reason })).data.data
}
