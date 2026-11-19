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
  /** 实际支付金额；未付款为空。 */
  paidAmount: string | null
  /** 支付成功时刻；未付款为空。 */
  paidAt: string | null
  /** 买家确认支付条款的时刻。 */
  termsConfirmedAt: string | null
  /** 支付时固定的最终约定发货日。 */
  shipDate: string | null
  /** 发货日次日零时，排他截止时刻。 */
  shipDeadlineAt: string | null
  /** 约定工期。 */
  durationDays: number
  /** 不随需求或报价变化的约定快照。 */
  agreementSnapshot: AgreementSnapshot
  /** 仅买家详情返回；创作者本阶段为空。 */
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
  /** 服务端核验的当前买家支付资格。 */
  canPay: boolean
  /** 仅买家待付款详情提供的支付确认内容。 */
  paymentPreview: OrderPaymentPreviewVO | null
  /** 仅详情提供的模拟支付流水和条款快照。 */
  payment: OrderPaymentVO | null
  /** 仅创作者可见的结算信息。 */
  settlement: OrderSettlementVO | null
  /** 支付后固定的五个节点，列表不返回详情。 */
  progressNodes: OrderProgressNodeVO[]
  /** 中标双方继续使用的会话编号。 */
  conversationId: string
  /** 已提交的订单状态历史。 */
  history: OrderHistoryVO[]
}
/** 支付确认只提交条款和日期，不接受客户端金额。 */
export interface OrderPaymentDTO {
  /** 买家已阅读并同意条款。 */
  termsConfirmed: true
  /** 本次确认的服务端条款版本。 */
  termsVersion: string
  /** 本次确认的最终发货日期。 */
  confirmedShipDate: string
}
export interface OrderPaymentPreviewVO {
  /** 按当前支付日测算的发货日。 */
  shipDate: string
  /** 发货日次日零时的排他截止时刻。 */
  shipDeadlineAt: string
  /** 服务端提供的条款版本。 */
  termsVersion: string
  /** 买家需要确认的完整条款。 */
  termsText: string
}
export interface OrderPaymentVO {
  /** 唯一模拟支付流水号。 */
  flowNo: string
  /** 服务端确定的支付金额。 */
  amount: string
  /** 支付处理结果。 */
  result: string
  /** 支付发生时间。 */
  occurredAt: string
  /** 已确认的条款版本快照。 */
  termsVersion: string
  /** 已确认的条款正文快照。 */
  termsText: string
}
export interface OrderSettlementVO {
  /** 应结算金额，等于买家实付金额。 */
  paidAmount: string
  /** 待结算、已结算或已取消。 */
  status: string
  /** 已审核收款人的脱敏姓名和账号。 */
  maskedPayee: string
}
export interface OrderProgressNodeVO {
  /** 固定制作节点编号。 */
  id: string
  /** 备料、打样、制作、质检或包装发货。 */
  nodeCode: string
  /** 制作节点顺序。 */
  sortOrder: number
  /** 支付时固定的初始参考完成日。 */
  plannedFinishDate: string
  /** 节点当前处理状态。 */
  status: string
  /** 实际处理时间，未处理为空。 */
  handledAt: string | null
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
