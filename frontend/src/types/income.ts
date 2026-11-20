/** 创作者收入记录行，金额与状态口径与订单详情一致。 */
export interface CreatorSettlementVO {
  /** 订单编号，可跳转订单详情。 */
  orderId: string
  /** 订单业务编号。 */
  orderNo: string
  /** 订单标题快照。 */
  title: string
  /** 应结算金额，等于买家实付金额。 */
  paidAmount: string
  /** 待结算、已结算或已取消。 */
  status: string
  /** 模拟结算时间，仅已结算记录存在。 */
  settledAt: string | null
  /** 已审核收款人的脱敏姓名和账号。 */
  maskedPayee: string
}

/** 管理员资金记录行，收款资料为已审核快照解密后的明文，仅管理员接口返回。 */
export interface AdminSettlementVO {
  /** 订单编号。 */
  orderId: string
  /** 订单业务编号。 */
  orderNo: string
  /** 订单标题快照。 */
  title: string
  /** 现货或定制订单类型。 */
  orderType: string
  /** 买家编号。 */
  buyerId: string
  /** 创作者编号。 */
  creatorId: string
  /** 应结算金额，等于买家实付金额。 */
  paidAmount: string
  /** 待结算、已结算或已取消。 */
  status: string
  /** 模拟结算时间，仅已结算记录存在。 */
  settledAt: string | null
  /** 退款取消待结算时间，仅已取消记录存在。 */
  cancelledAt: string | null
  /** 收款人姓名明文。 */
  realName: string
  /** 收款账号明文。 */
  payeeAccount: string
  /** 结算记录创建时间。 */
  createdAt: string
}
