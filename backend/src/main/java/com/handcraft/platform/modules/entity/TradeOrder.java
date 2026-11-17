package com.handcraft.platform.modules.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/** 定制订单与不可变交易快照，不生成包含个人资料的toString。 */
@Getter @Setter
public class TradeOrder {
    /** 订单编号。 */
    private Long id;
    /** 对外订单号。 */
    private String orderNo;
    /** 履约类型。 */
    private String orderType;
    /** 买家编号。 */
    private Long buyerId;
    /** 中标创作者编号。 */
    private Long creatorId;
    /** 来源需求编号。 */
    private Long requestId;
    /** 中标报价编号。 */
    private Long quoteId;
    /** 持久化交易状态。 */
    private String status;
    /** 需求标题快照。 */
    private String titleSnapshot;
    /** 成交金额快照。 */
    private BigDecimal totalAmount;
    /** 自然日工期快照。 */
    private Integer durationDays;
    /** 不可变约定JSON。 */
    private String agreementSnapshot;
    /** 仅授权本人读取的完整地址快照。 */
    private String addressSnapshot;
    /** 创建二十四小时付款截止。 */
    private LocalDateTime payDeadlineAt;
    /** 买家范围建单幂等键。 */
    private String createRequestKey;
    /** 建单时间。 */
    private LocalDateTime createdAt;
    /** 状态变更时间。 */
    private LocalDateTime updatedAt;
}
