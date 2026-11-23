import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { AdminDashboardVO, AdminOrderDetailVO, AdminOrderPage, AdminUserDetailVO, AdminUserPage, UserBusinessState } from '@/types/admin'

async function get<T>(path: string, params?: object) { return (await request.get<ApiResult<T>>(path, { params })).data.data }

/** 管理员看板只读统计。 */
export const getAdminDashboard = (params: object = {}) => get<AdminDashboardVO>('/admin/dashboard', params)
/** 按邮箱、昵称和认证状态查询用户。 */
export const getAdminUsers = (params: object = {}) => get<AdminUserPage>('/admin/users', params)
/** 查询单个用户及关联业务摘要。 */
export const getAdminUser = (id: string) => get<AdminUserDetailVO>(`/admin/users/${id}`)
/** 管理员暂停/恢复账号新业务，原因留存在操作日志。 */
export async function setAdminBusinessPause(id: string, paused: boolean, reason: string, recoveryCondition?: string) {
  return (await request.put<ApiResult<UserBusinessState>>(`/admin/users/${id}/business-pause`, { paused, reason, recoveryCondition })).data.data
}
/** 查询本人两种暂停状态。 */
export const getCreatorPauseState = () => get<UserBusinessState>('/me/creator-pause')
/** 创作者本人暂停或恢复接单。 */
export async function setCreatorPause(paused: boolean) { return (await request.put<ApiResult<UserBusinessState>>('/me/creator-pause', { paused })).data.data }
/** 管理员跨类型订单综合查询。 */
export const getAdminOrders = (params: object = {}) => get<AdminOrderPage>('/admin/orders', params)
/** 查询单笔订单的约定、履约、资金及会话只读资料。 */
export const getAdminOrder = (id: string) => get<AdminOrderDetailVO>(`/admin/orders/${id}`)
