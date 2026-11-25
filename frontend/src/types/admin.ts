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

interface AdminUserRelatedWorkVO {
  id: string | number
  title?: string | null
  status: string
}

interface AdminUserRelatedOrderVO {
  id: string | number
  orderNo: string
  orderType: string
  status: string
  amount: string | number
}

interface AdminUserPauseHistoryVO {
  operatorId: string | number
  action: string
  beforeStatus: string
  afterStatus: string
  reason?: string | null
  recoveryCondition?: string | null
  createdAt: string
}

/** 用户详情的近期业务摘要。 */
export interface AdminUserDetailVO {
  user: AdminUserVO
  workCount: number
  requestCount: number
  orderCount: number
  works: AdminUserRelatedWorkVO[]
  requests: AdminUserRelatedWorkVO[]
  orders: AdminUserRelatedOrderVO[]
  pauseHistory: AdminUserPauseHistoryVO[]
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
  attention?: 'AFTER_SALE' | 'START_OVERDUE' | 'SHIPPING_OVERDUE' | null
}

export type AdminUserPage = PageVO<AdminUserVO>
export type AdminOrderPage = PageVO<AdminOrderVO>

/** 制作进度记录，与后端 OrderProgressRecordVO 对应。 */
export interface AdminOrderProgressRecordVO {
  id: string
  recordType: string
  content?: string | null
  imageIds: string[]
  skipReason?: string | null
  createdAt: string
}

/** 制作进度节点，与后端 OrderProgressNodeVO 对应。 */
export interface AdminOrderProgressNodeVO {
  id: string
  nodeCode: string
  sortOrder: number
  plannedFinishDate?: string | null
  status: string
  handledAt?: string | null
  records: AdminOrderProgressRecordVO[]
  deviationDays?: number
  overdue?: boolean
}

/** 管理员只读订单视图，与后端 AdminRefundOrderVO 对应，不返回收款账户。 */
export interface AdminRefundOrderVO {
  id: string
  orderNo: string
  title: string
  status: string
  buyerId: string
  buyerNickname: string
  creatorId: string
  creatorNickname: string
  requestId?: string | null
  quoteId?: string | null
  totalAmount: string
  agreementSnapshot: Record<string, unknown>
  addressSnapshot: Record<string, unknown>
  paidAt?: string | null
  startedAt?: string | null
  shipDeadlineAt?: string | null
  trackingNo?: string | null
  shippedAt?: string | null
  autoConfirmAt?: string | null
  originalCompletedAt?: string | null
  conversationId?: string | null
  payment?: Record<string, unknown> | null
  settlement?: Record<string, unknown> | null
  progressNodes: AdminOrderProgressNodeVO[]
}

/** 订单成功资金流水摘要。 */
export interface AdminOrderFundFlowVO {
  flowNo?: string
  type: string
  amount: string
  occurredAt: string
}

/** 后台订单详情内原有消息的兼容类型。 */
export interface AdminOrderChatMessageVO {
  id: string
  senderId: string
  content?: string | null
  imageIds: string[]
  createdAt: string
}

/** 订单关联会话的活动摘要。 */
export interface AdminOrderConversationSummaryVO {
  /** 会话编号。 */
  conversationId: string
  /** 最近一条消息的序号，无消息时为 "0"。 */
  lastMessageSeq: string
  /** 最近一条消息时间，无消息时为空。 */
  lastMessageAt: string | null
  /** 归档时间，未归档时为空。 */
  archivedAt: string | null
}

/** 管理员只读订单详情。 */
export interface AdminOrderDetailVO {
  order: AdminRefundOrderVO
  fundFlows: AdminOrderFundFlowVO[]
  /** 兼容字段，服务端返回空数组。 */
  messages: AdminOrderChatMessageVO[]
  orderType: 'CUSTOM' | 'STOCK'
  /** 关联会话摘要，无会话时为空。 */
  conversationSummary: AdminOrderConversationSummaryVO | null
  /** 可直接定位的本单售后申请编号。 */
  refundApplicationId: string | null
}

/** 账号两种暂停标记分别返回，操作其中一个不改变另一个。 */
export interface UserBusinessState {
  userId: string
  adminBusinessPaused: boolean
  creatorPaused: boolean
}
