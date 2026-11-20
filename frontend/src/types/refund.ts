import type { AgreementSnapshot, OrderProgressNodeVO, OrderVO } from './quote'

/** 普通申请仅传原因、原始说明和本人上传的凭证，不接受客户端金额。 */
export interface RefundCreateDTO {
  /** 本人范围的首次请求键。 */
  requestKey: string
  /** 固定业务原因。 */
  reasonCode: string
  /** 20—500字申请说明。 */
  description: string
  /** 本单退款图片编号，最多三张。 */
  imageIds: string[]
}
export interface RefundEvidenceDTO {
  /** 同次补证及重试共用请求键。 */
  requestKey: string
  /** 最多500字，可与图片择一。 */
  content: string
  /** 本单本人上传的证据图片。 */
  imageIds: string[]
}
export interface RefundDecisionDTO {
  /** 管理员实际查阅的申请版本，不自动升级重放。 */
  expectedVersion: number
  /** 批准全额退款或驳回。 */
  decision: 'APPROVE' | 'REJECT'
  /** 1—500字裁定原因。 */
  reason: string
  /** 是否要求退回原成品。 */
  returnRequired: boolean
  /** 管理员确认已退回原成品。 */
  returnedConfirmed: boolean
  /** 8—30位退回运单号，可与证据择一。 */
  returnTrackingNo: string
  /** 当前申请已保存的初始/补充凭证编号。 */
  returnEvidenceImageIds: string[]
  /** 无需退回时的核实依据。 */
  noReturnBasis: string
}
export interface RefundApplicationVO extends Omit<RefundCreateDTO, 'requestKey'> {
  /** 申请编号。 */
  id: string
  /** 关联订单编号。 */
  orderId: string
  /** 关联订单流水号。 */
  orderNo: string
  /** 本单买家编号。 */
  buyerId: string
  /** 本单创作者编号。 */
  creatorId: string
  /** NORMAL普通或系统无责类型。 */
  applicationType: string
  /** 进入售后前的原始状态。 */
  originalOrderStatus: string
  /** WAIT_ADMIN、REFUNDED、REJECTED或WITHDRAWN。 */
  status: string
  /** 创建时的原请求键，旧记录可空。 */
  createRequestKey: string | null
  /** 每次有效补证递增的版本。 */
  version: number
  /** 申请开始时间。 */
  createdAt: string
  /** 申请终结时间。 */
  finishedAt: string | null
  /** 裁定管理员编号，系统处理可空。 */
  handlerId: string | null
  /** 保留的处理结论。 */
  decisionReason: string | null
  /** 是否需要退货。 */
  returnRequired: boolean | null
  /** 已核实的退回单号。 */
  returnTrackingNo: string | null
  /** 服务端记录的核实时间。 */
  returnConfirmedAt: string | null
  /** 核实管理员编号。 */
  returnConfirmedBy: string | null
  /** 无需退货依据。 */
  noReturnBasis: string | null
  /** 服务端当前补证资格。 */
  canSupplement: boolean
  /** 服务端当前撤回资格。 */
  canWithdraw: boolean
  /** 服务端原实付全额退款金额。 */
  refundAmount: string
  /** 售后仍可使用的原会话编号。 */
  conversationId: string
}
export interface RefundEvidenceVO extends Omit<RefundEvidenceDTO, 'requestKey'> {
  /** 不可覆盖的证据编号。 */
  id: string
  /** 所属申请编号。 */
  refundApplicationId: string
  /** 提交者编号。 */
  submitterId: string
  /** 补证的原请求键。 */
  requestKey: string
  /** 实际提交时间。 */
  createdAt: string
}
export interface RefundEvidencePageVO {
  /** 当前批证据，编号升序。 */
  items: RefundEvidenceVO[]
  /** 排他的下一批起点。 */
  nextCursor: string | null
  /** 是否仍有历史证据。 */
  hasMore: boolean
}
export interface AdminRefundQueueVO {
  /** 申请编号。 */
  id: string
  /** 关联订单编号。 */
  orderId: string
  /** 订单流水号。 */
  orderNo: string
  /** 订单标题。 */
  title: string
  /** 买家编号。 */
  buyerId: string
  /** 创作者编号。 */
  creatorId: string
  /** 普通/系统无责申请类型。 */
  applicationType: string
  /** 进入售后前状态。 */
  originalOrderStatus: string
  /** 申请原因。 */
  reasonCode: string
  /** 当前申请状态。 */
  status: string
  /** 当前材料版本。 */
  version: number
  /** 申请时间。 */
  createdAt: string
  /** 终结时间。 */
  finishedAt: string | null
  /** 原商品成交金额。 */
  totalAmount: string
}
export interface AdminRefundOrderVO extends Pick<OrderVO, 'id' | 'orderNo' | 'title' | 'status' | 'buyerId' | 'buyerNickname' | 'creatorId' | 'creatorNickname' | 'requestId' | 'quoteId' | 'totalAmount' | 'addressSnapshot' | 'paidAt' | 'startedAt' | 'shipDeadlineAt' | 'trackingNo' | 'shippedAt' | 'autoConfirmAt' | 'originalCompletedAt' | 'conversationId'> {
  /** 不可修改的原订单约定。 */
  agreementSnapshot: AgreementSnapshot
  /** 只读支付摘要。 */
  payment: { flowNo: string; amount: string; occurredAt: string } | null
  /** 只读资金状态，不含可修改账户。 */
  settlement: { paidAmount: string; status: string } | null
  /** 五节点及不可变追加记录。 */
  progressNodes: OrderProgressNodeVO[]
}
export interface AdminRefundHistoryVO {
  /** 历史编号。 */
  id: string
  /** 操作者编号。 */
  operatorId: string
  /** 操作者类别。 */
  operatorType: string
  /** 原始操作动作。 */
  action: string
  /** 操作前状态。 */
  beforeStatus: string | null
  /** 操作后状态。 */
  afterStatus: string | null
  /** 操作依据。 */
  reason: string | null
  /** 保留的原始事实。 */
  detail: unknown
  /** 提交时间。 */
  createdAt: string
}
export interface AdminRefundDetailVO {
  /** 当前申请及材料版本。 */
  application: RefundApplicationVO
  /** 与此售后关联的订单只读快照。 */
  order: AdminRefundOrderVO
  /** 原始历史，不提供编辑。 */
  history: AdminRefundHistoryVO[]
  /** 服务端当前是否允许裁定。 */
  canDecide: boolean
  /** 已提交的完整原裁定输入，供未知结果精确核验。 */
  decisionFacts: RefundDecisionDTO | null
  /** 当前服务器时间。 */
  serverTime: string
}
