package com.handcraft.platform.modules.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/** 报价不可变方案及有效状态，撤回重报保留历史。 */
@Getter @Setter
public class Quote {
    /** 报价编号。 */
    private Long id;
    /** 所属需求编号。 */
    private Long requestId;
    /** 报价创作者编号。 */
    private Long creatorId;
    /** 创作者范围提交幂等键。 */
    private String createRequestKey;
    /** 约定商品金额。 */
    private BigDecimal goodsAmount;
    /** 自然日工期。 */
    private Integer durationDays;
    /** 材料工艺方案。 */
    private String proposal;
    /** 可选补充约定。 */
    private String additionalAgreement;
    /** 效果图编号JSON。 */
    private String imageIds;
    /** 报价持久化状态。 */
    private String status;
    /** 七天有效截止时间。 */
    private LocalDateTime expiresAt;
    /** 撤回、到期或需求关闭原因。 */
    private String invalidReason;
    /** 实际失效时间。 */
    private LocalDateTime invalidatedAt;
    /** 提交时间及每日额度依据。 */
    private LocalDateTime createdAt;
    /** 最后状态变更时间。 */
    private LocalDateTime updatedAt;
}
