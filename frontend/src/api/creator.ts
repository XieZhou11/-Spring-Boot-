import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { SessionVO } from '@/types/auth'
import type { ActiveRoleDTO, ApplicationStatus, ApplicationSummaryVO, ApplicationVO, CategoryDTO, CategoryVO, CertificationVO, CreatorApplicationDTO, CreatorReviewDTO, ImageVO, NotificationVO, PageVO } from '@/types/creator'

/** 入驻及后台资源统一使用现有 Cookie/CSRF 安全链。 */
async function get<T>(path: string, params?: object) {
  return (await request.get<ApiResult<T>>(path, { params })).data.data
}
export const getCategories = (admin = false) => get<CategoryVO[]>(admin ? '/admin/categories' : '/categories')
export const getCertification = () => get<CertificationVO>('/me/creator-certification')
export const getApplications = (page = 1, admin = false, status?: ApplicationStatus | '') =>
  get<PageVO<ApplicationSummaryVO>>(admin ? '/admin/creator-applications' : '/me/creator-applications', { page, size: 20, ...(status ? { status } : {}) })
export const getApplication = (id: string, admin = false) => get<ApplicationVO>(`${admin ? '/admin' : '/me'}/creator-applications/${id}`)
export const getApplicationImage = (id: string) => get<ImageVO>(`/creator-application-images/${id}`)

export async function uploadApplicationImage(file: File) {
  const input = new FormData()
  input.append('file', file)
  return (await request.post<ApiResult<ImageVO>>('/creator-application-images', input, { timeout: 60_000 })).data.data
}
export async function submitApplication(input: CreatorApplicationDTO) {
  return (await request.post<ApiResult<ApplicationVO>>('/me/creator-applications', input)).data.data
}
export async function withdrawApplication(id: string) {
  return (await request.put<ApiResult<ApplicationVO>>(`/me/creator-applications/${id}/withdrawal`)).data.data
}
export async function reviewApplication(id: string, decision: CreatorReviewDTO['decision'], reason: string) {
  const input: CreatorReviewDTO = { decision, reason }
  return (await request.put<ApiResult<ApplicationVO>>(`/admin/creator-applications/${id}/review`, input)).data.data
}
export async function saveCategory(input: CategoryDTO, id?: string) {
  return id
    ? (await request.put<ApiResult<CategoryVO>>(`/admin/categories/${id}`, input)).data.data
    : (await request.post<ApiResult<CategoryVO>>('/admin/categories', input)).data.data
}
export async function switchActiveRole(activeRole: ActiveRoleDTO['activeRole']) {
  const input: ActiveRoleDTO = { activeRole }
  return (await request.put<ApiResult<SessionVO>>('/sessions/current/active-role', input)).data.data
}
export const getNotifications = (page = 1) => get<PageVO<NotificationVO>>('/me/notifications', { page, size: 20 })
export const getUnreadCount = () => get<{ count: number }>('/me/notifications/unread-count')
export async function readNotification(id: string) {
  return (await request.put<ApiResult<NotificationVO>>(`/me/notifications/${id}/read`)).data.data
}
