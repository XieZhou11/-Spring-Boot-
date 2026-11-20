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
    /** 现货来源作品编号，定制订单为空。 */
    private Long workId;
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
    /** 原成功支付时间，后续状态变更不覆盖。 */
    private LocalDateTime paidAt;
    /** 买家确认支付条款的时间。 */
    private LocalDateTime termsConfirmedAt;
    /** 最终发货日次日零时的排他截止上界。 */
    private LocalDateTime shipDeadlineAt;
    /** 实际确认开工时间，不随重试变化。 */
    private LocalDateTime startedAt;
    /** 当前有效运单号，原值及更正保留操作历史。 */
    private String trackingNo;
    /** 第五节点首次提交的原发货时间。 */
    private LocalDateTime shippedAt;
    /** 自动收货截止，更正运单不重置。 */
    private LocalDateTime autoConfirmAt;
    /** 首次收货时间，售后恢复不得改写。 */
    private LocalDateTime originalCompletedAt;
    /** 买家范围建单幂等键。 */
    private String createRequestKey;
    /** 买家对定制成品案例公开授权的当前状态。 */
    private String publicationConsentStatus;
    /** 条件更新时读取到的原授权状态。 */
    private String expectedConsentStatus;
    /** 创作者申请公开成品案例的时间。 */
    private LocalDateTime publicationRequestedAt;
    /** 买家明确回复公开授权的时间。 */
    private LocalDateTime publicationRespondedAt;
    /** 建单时间。 */
    private LocalDateTime createdAt;
    /** 状态变更时间。 */
    private LocalDateTime updatedAt;
}
