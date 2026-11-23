import type { PageVO } from '@/types/creator'

/** 后台按需聚合的基础看板数据。 */
export interface AdminDashboardVO {
  updatedAt: string
  userTotal: number
  newUsers: number
  certifiedCreators: number
  newCertifiedCreators: number
  works: Record<string, number>
  requests: Record<string, number>
  orders: Record<string, number>
  paymentAmount: string
  refundAmount: string
  pendingSettlementAmount: string
  settledAmount: string
  todos: Record<string, number>
  from: string
  to: string
}

/** 管理员用户列表行。 */
export interface AdminUserVO {
  userId: string | number
  email: string
  nickname: string
  certificationStatus: string
  creatorPaused: boolean | number
  adminBusinessPaused: boolean | number
  createdAt: string
}

/** 用户详情的近期业务摘要。 */
export interface AdminUserDetailVO {
  user: AdminUserVO
  workCount: number
  requestCount: number
  orderCount: number
  works: Array<Record<string, unknown>>
  requests: Array<Record<string, unknown>>
  orders: Array<Record<string, unknown>>
  pauseHistory: Array<Record<string, unknown>>
}

/** 管理员全局订单列表。 */
export interface AdminOrderVO {
  orderId: string
  orderNo: string
  orderType: string
  status: string
  title: string
  amount: string
  buyerId: string
  buyerNickname: string
  creatorId: string
  creatorNickname: string
  createdAt: string
}

export type AdminUserPage = PageVO<AdminUserVO>
export type AdminOrderPage = PageVO<AdminOrderVO>

/** 管理员只读订单详情。 */
export interface AdminOrderDetailVO {
  order: Record<string, any>
  fundFlows: Array<Record<string, string>>
  messages: Array<Record<string, any>>
}

/** 账号两种暂停标记分别返回，操作其中一个不改变另一个。 */
export interface UserBusinessState {
  userId: string
  adminBusinessPaused: boolean
  creatorPaused: boolean
}
