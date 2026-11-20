package com.handcraft.platform.modules.entity;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;
/** 已提交证据只可追加，不可修改。 */
@Getter @Setter
public class RefundEvidence {
    /** 证据编号。 */ private Long id;
    /** 所属申请。 */ private Long refundApplicationId;
    /** 提交订单双方之一。 */ private Long submitterId;
    /** 提交者范围幂等键。 */ private String requestKey;
    /** 可选补充说明。 */ private String content;
    /** 零至三张凭证编号JSON。 */ private String imageIds;
    /** 提交时间。 */ private LocalDateTime createdAt;
}
