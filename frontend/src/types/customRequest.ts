import type { PublicationQuotaVO } from './work'

/** 需求正文；金额保持十进制字符串，日期为北京时间自然日。 */
export interface RequestContent {
  /** 标题。 */
  title: string
  /** 启用末级品类。 */
  categoryId: string | null
  /** 用途。 */
  purpose: string
  /** 材质偏好。 */
  materialPreference: string
  /** 尺寸规格。 */
  specification: string
  /** 预算下限。 */
  budgetMin: string | null
  /** 预算上限。 */
  budgetMax: string | null
  /** 期望发货日。 */
  expectedShipDate: string | null
  /** 需求描述。 */
  description: string
  /** 本人参考图。 */
  referenceImageIds: string[]
  /** 公开或单人定向。 */
  visibility: 'PUBLIC' | 'DIRECTED'
  /** 唯一受邀创作者。 */
  invitedCreatorId: string | null
  /** 可选来源作品。 */
  sourceWorkId: string | null
}
export interface CustomRequestVO extends RequestContent {
  /** 需求编号。 */
  id: string
  /** 买家公开昵称。 */
  buyerNickname: string
  /** 品类路径。 */
  categoryPath: string[]
  /** 受邀人昵称。 */
  invitedCreatorNickname: string | null
  /** 完整业务状态。 */
  status: string
  /** 乐观版本。 */
  version: string
  /** 发布时刻。 */
  publishedAt: string | null
  /** 无有效报价到期时刻。 */
  noQuoteExpireAt: string | null
  /** 关闭时刻。 */
  closedAt: string | null
  /** 创建时刻。 */
  createdAt: string
  /** 更新时间。 */
  updatedAt: string
  /** 是否本人需求。 */
  owned: boolean
  /** 服务端允许编辑。 */
  canEdit: boolean
  /** 服务端允许发布。 */
  canPublish: boolean
  /** 服务端允许关闭。 */
  canClose: boolean
  /** 服务端允许复制。 */
  canCopy: boolean
  /** 服务端允许进入沟通。 */
  canConsult: boolean
  /** 不能咨询的原因。 */
  consultationReason: string | null
  /** 服务端综合资格、状态和额度后的报价权限。 */
  canQuote: boolean
  /** 不能报价的具体原因。 */
  quoteDisabledReason: string | null
}
export type RequestQuotaVO = PublicationQuotaVO
export interface ConversationVO {
  /** 会话编号。 */
  id: string
  /** 关联需求，现货会话为空。 */
  requestId: string | null
  /** 关联定标或现货订单，无订单时为空。 */
  orderId: string | null
  /** 关联订单标题，无订单时为空。 */
  orderTitle: string | null
  /** 关联订单当前状态，无订单时为空。 */
  orderStatus: string | null
  /** 关联订单成交金额（十进制字符串），无订单时为空。 */
  orderAmount: string | null
  /** 现货订单成交主图编号，无订单或定制订单为空。 */
  orderCoverImageId: string | null
  /** 需求标题，无需求时为空。 */
  requestTitle: string | null
  /** 需求状态，无需求时为空。 */
  requestStatus: string | null
  /** 对方编号。 */
  otherUserId: string
  /** 对方昵称。 */
  otherNickname: string
  /** 对方头像短时访问地址，无头像或存储不可用时为空。 */
  otherAvatarUrl: string | null
  /** 对方头像地址失效时间，到期前重读会话续签。 */
  otherAvatarExpiresAt: string | null
  /** 未读条数。 */
  unreadCount: number
  /** 最近消息时间。 */
  lastMessageAt: string | null
  /** 当前最大序号。 */
  lastMessageSeq: string
  /** 本人已读序号。 */
  readSeq: string
  /** 服务端发送资格。 */
  canSend: boolean
  /** 禁止发送原因。 */
  sendDisabledReason: string | null
  /** 归档时间。 */
  archivedAt: string | null
  /** 归档原因。 */
  archiveReason: string | null
}
export interface ChatMessageVO {
  /** 手动发送时引用的本订单节点，无引用为空。 */
  referencedNodeId: string | null
  /** 引用节点的固定业务编码，用于展示节点名称。 */
  referencedNodeCode: string | null
  /** 唯一消息编号，用于去重。 */
  id: string
  /** 归属会话。 */
  conversationId: string
  /** 会话内单调序号。 */
  seqNo: string
  /** 发送者编号。 */
  senderId: string
  /** 客户端幂等键。 */
  clientMessageKey: string
  /** 正文，可空。 */
  content: string | null
  /** 会话图片。 */
  imageIds: string[]
  /** 服务器发送时间。 */
  createdAt: string
}
