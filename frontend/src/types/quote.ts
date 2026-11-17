import type { AddressDTO } from './account'

/** 北京时间自然日的报价提交额度。 */
export interface QuoteQuotaVO {
  /** 今日已提交次数，含撤回后的重报。 */
  used: number
  /** 每日最多提交次数。 */
  limit: number
  /** 今日剩余次数。 */
  remaining: number
}

/** 报价创建后不可编辑；撤回重报生成独立历史。 */
export interface QuoteDTO {
  /** 同次提交及未知结果重试共用的请求键。 */
  requestKey: string
  /** 商品金额，最多两位小数。 */
  goodsAmount: string
  /** 包含开工等待的自然日工期。 */
  durationDays: number
  /** 材料和工艺方案。 */
  proposal: string
  /** 材料、修改等补充约定。 */
  additionalAgreement: string
  /** 本人上传的方案图片编号。 */
  imageIds: string[]
}
export interface QuoteVO extends Omit<QuoteDTO, 'requestKey' | 'additionalAgreement'> {
  /** 未填写的补充约定返回 null。 */
  additionalAgreement: string | null
  /** 报价编号。 */
  id: string
  /** 所属需求编号。 */
  requestId: string
  /** 所属需求标题。 */
  requestTitle: string
  /** 创作者编号。 */
  creatorId: string
  /** 创作者公开昵称。 */
  creatorNickname: string
  /** 有效、中标、落选或失效。 */
  status: string
  /** 失效原因，未失效为空。 */
  invalidReason: string | null
  /** 创建时间。 */
  createdAt: string
  /** 固定七天到期时间。 */
  expiresAt: string
  /** 服务端按当前北京时间测算的发货日期。 */
  estimatedShipDate: string
  /** 平均评分，无评价为 null。 */
  averageRating: string | null
  /** 评价数量。 */
  reviewCount: number
  /** 完成订单数量。 */
  completedOrderCount: number
  /** 是否本人报价。 */
  owned: boolean
  /** 服务端核验的撤回资格。 */
  canWithdraw: boolean
  /** 服务端核验的定标资格。 */
  canAward: boolean
}
export interface QuoteComparisonVO {
  /** 所属需求编号。 */
  requestId: string
  /** 需求标题。 */
  requestTitle: string
  /** 买家期望发货日期。 */
  expectedShipDate: string
  /** 最多五份当前有效报价。 */
  items: QuoteVO[]
  /** 当前有效报价数量。 */
  activeCount: number
  /** 同时有效报价上限。 */
  limit: number
  /** 服务端定标资格。 */
  canAward: boolean
  /** 无法定标原因。 */
  awardDisabledReason: string | null
  /** 服务器当前北京时间日期。 */
  serverDate: string
}
export interface AwardDTO {
  /** 同次确认共用请求键，结果未知时不能替换。 */
  requestKey: string
  /** 选中的有效报价编号。 */
  quoteId: string
  /** 本人选择的收货地址编号。 */
  addressId: string
  /** 买家实际确认的预计发货日期。 */
  confirmedEstimatedShipDate: string
}
export interface AgreementSnapshot {
  /** 定标时锁定的需求正文。 */
  request: {
    /** 需求标题。 */
    title: string
    /** 详细描述。 */
    description: string
    /** 用途。 */
    purpose: string
    /** 材料偏好。 */
    materialPreference: string
    /** 尺寸规格。 */
    specification: string
    /** 定标时品类路径。 */
    categoryPath: string[]
    /** 原需求参考图片。 */
    referenceImageIds: string[]
    /** 可选来源作品编号。 */
    sourceWorkId: string | null
  }
  /** 中标方案说明。 */
  proposal: string
  /** 中标补充约定。 */
  additionalAgreement: string | null
  /** 中标方案图片。 */
  imageIds: string[]
  /** 需求期望发货日期。 */
  expectedShipDate: string
  /** 定标确认的测算发货日期。 */
  confirmedEstimatedShipDate: string
  /** 约定自然日工期。 */
  durationDays: number
  /** 约定商品金额。 */
  goodsAmount: string
}
export interface OrderVO {
  /** 订单资源编号。 */
  id: string
  /** 公开订单流水号。 */
  orderNo: string
  /** 订单类型，本阶段为定制。 */
  orderType: string
  /** 买家编号。 */
  buyerId: string
  /** 买家昵称。 */
  buyerNickname: string
  /** 创作者编号。 */
  creatorId: string
  /** 创作者昵称。 */
  creatorNickname: string
  /** 关联需求编号。 */
  requestId: string
  /** 中标报价编号。 */
  quoteId: string
  /** 当前订单业务状态。 */
  status: string
  /** 订单标题。 */
  title: string
  /** 商品成交金额。 */
  totalAmount: string
  /** 约定工期。 */
  durationDays: number
  /** 不随需求或报价变化的约定快照。 */
  agreementSnapshot: AgreementSnapshot
  /** 本人收货地址快照；未付款创作者不可见。 */
  addressSnapshot: (Omit<AddressDTO, 'isDefault'> & { id?: string }) | null
  /** 建单时间。 */
  createdAt: string
  /** 24 小时付款截止时间。 */
  payDeadlineAt: string
  /** 取消时间。 */
  cancelledAt: string | null
  /** 取消原因。 */
  cancelReason: string | null
  /** 当前用户是否订单买家。 */
  owned: boolean
  /** 服务端是否允许取消。 */
  canCancel: boolean
  /** 中标双方继续使用的会话编号。 */
  conversationId: string
  /** 已提交的订单状态历史。 */
  history: OrderHistoryVO[]
}
export interface OrderHistoryVO {
  /** 状态变更动作。 */
  action: string
  /** 原状态，建单时为空。 */
  fromStatus: string | null
  /** 新状态。 */
  toStatus: string
  /** 操作原因。 */
  reason: string | null
  /** 已提交的变更时刻。 */
  createdAt: string
}
