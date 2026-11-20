import type { AddressDTO } from './account'
import type { RefundApplicationVO } from './refund'

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
  /** 买家及服务端允许的创作者发货阶段返回的固定收货资料。 */
  addressSnapshot: (Omit<AddressDTO, 'isDefault'> & { id?: string }) | null
  /** 实际确认开工时刻，未开工为空。 */
  startedAt: string | null
  /** 支付后48小时确认开工截止时刻。 */
  startDeadlineAt: string | null
  /** 当前运单号；尚未发货为空。 */
  trackingNo: string | null
  /** 首次发货时刻，更正单号不改变。 */
  shippedAt: string | null
  /** 服务端计算的自动确认收货时刻。 */
  autoConfirmAt: string | null
  /** 最初完成时刻，售后恢复不重设。 */
  originalCompletedAt: string | null
  /** 本次快照的服务器北京时间。 */
  serverTime: string
  /** 服务端核验的确认开工资格。 */
  canStart: boolean
  /** 服务端核验的第五节点原子发货资格。 */
  canShip: boolean
  /** 服务端核验的运单号更正资格。 */
  canCorrectTracking: boolean
  /** 服务端核验的买家确认收货资格。 */
  canConfirmReceipt: boolean
  /** 服务端按48小时边界核验的未开工退款资格。 */
  canRequestNoStartRefund: boolean
  /** 服务端核验的买家普通售后申请资格。 */
  canRequestRefund: boolean
  /** 最初完成后七天排他截止时刻，完成前为空。 */
  refundWindowEndsAt: string | null
  /** 当前处理中申请，无申请时为空。 */
  currentRefund: RefundApplicationVO | null
  /** 已过固定约定发货截止且尚未发货。 */
  shippingOverdue: boolean
  /** 运单号历次更正记录，不覆盖原值。 */
  trackingHistory: OrderTrackingHistoryVO[]
  /** 系统未开工全额退款依据与流水。 */
  noStartRefund: OrderNoStartRefundVO | null
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
  /** 本节点不可覆盖的首次记录和历次补充。 */
  records: OrderProgressRecordVO[]
  /** 当前参与方是否可首次提交本节点。 */
  canCheckIn: boolean
  /** 当前参与方是否可说明原因跳过打样节点。 */
  canSkip: boolean
  /** 当前参与方是否可追加本节点图文。 */
  canSupplement: boolean
  /** 相对固定参考完成日的有符号自然日差，正数为延后。 */
  deviationDays: number | null
  /** 尚未处理且已过参考完成日。 */
  overdue: boolean
}
export interface OrderProgressRecordVO {
  /** 不可变的记录编号。 */
  id: string
  /** 首次请求与重试共用的请求键。 */
  requestKey: string
  /** 首次打卡、跳过或追加记录类型。 */
  recordType: string
  /** 阶段说明，纯图片补充可为空。 */
  content: string | null
  /** 本记录按提交顺序保存的进度图片编号。 */
  imageIds: string[]
  /** 打样跳过原因，非跳过记录为空。 */
  skipReason: string | null
  /** 服务端实际提交时刻。 */
  createdAt: string
}
export interface OrderTrackingHistoryVO {
  /** 运单更正记录编号。 */
  id: string
  /** 本次更正的幂等请求键。 */
  requestKey: string
  /** 更正前的原运单号。 */
  oldTrackingNo: string
  /** 本次更正后的运单号。 */
  newTrackingNo: string
  /** 本次更正的操作者编号。 */
  operatorId: string
  /** 更正提交时刻。 */
  createdAt: string
}
export interface OrderNoStartRefundVO {
  /** 唯一系统无责退款申请编号。 */
  id: string
  /** 买家提交的原始退款说明。 */
  description: string
  /** 买家提交的凭证图片编号。 */
  imageIds: string[]
  /** 按原实付金额确定的全额退款金额。 */
  amount: string
  /** 唯一模拟退款流水号。 */
  flowNo: string
  /** 退款实际完成时刻。 */
  occurredAt: string
  /** 系统校验并执行无责退款的依据。 */
  decisionReason: string
}
/** 图文写操作必须固定请求键与原始内容后才可发送。 */
export interface OrderProgressDTO {
  /** 同一提交和未知结果重试共用的请求键。 */
  requestKey: string
  /** 阶段说明或追加说明。 */
  content: string
  /** 本单创作者上传的私有进度图片。 */
  imageIds: string[]
}
export interface OrderSkipDTO extends OrderProgressDTO {
  /** 仅打样可填写的跳过原因。 */
  skipReason: string
}
export interface OrderShipmentDTO extends OrderProgressDTO {
  /** 8—30位字母数字运单号，与第五节点同时提交。 */
  trackingNo: string
}
export interface OrderTrackingDTO {
  /** 更正与原内容重试共用的请求键。 */
  requestKey: string
  /** 用户确认时看到的原运单号，防止覆盖其他端更正。 */
  expectedTrackingNo: string
  /** 更正后的8—30位字母数字运单号。 */
  trackingNo: string
}
export interface OrderNoStartRefundDTO {
  /** 20—500字未开工退款说明，不接受客户端金额。 */
  description: string
  /** 最多3张本人上传的本单退款凭证。 */
  imageIds: string[]
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
