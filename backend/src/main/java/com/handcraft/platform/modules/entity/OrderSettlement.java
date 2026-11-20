package com.handcraft.platform.modules.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/** 支付时固定收款申请及加密账号，后续审核变更不会覆盖原单。 */
@Getter @Setter
public class OrderSettlement {
    /** 结算记录编号。 */
    private Long id;
    /** 每单唯一订单编号。 */
    private Long orderId;
    /** 原实付及应结算金额。 */
    private BigDecimal paidAmount;
    /** 已审核申请编号、姓名和Base64编码密文快照。 */
    private String payeeSnapshot;
    /** PENDING待结算、SETTLED已结算或CANCELLED已取消。 */
    private String status;
    /** 成功结算流水的fund_flow编号，仅已结算记录存在。 */
    private Long settlementFlowId;
    /** 模拟结算时间，仅已结算记录存在。 */
    private LocalDateTime settledAt;
    /** 退款取消待结算的时间，仅已取消记录存在。 */
    private LocalDateTime cancelledAt;
    /** 支付建立结算记录的时间。 */
    private LocalDateTime createdAt;
}
