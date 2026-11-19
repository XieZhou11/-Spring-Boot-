package com.handcraft.platform.modules.entity;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;
/** 无责退款保存申请原文与服务端裁定依据。 */
@Getter @Setter
public class RefundApplication {
    /** 申请编号。 */ private Long id;
    /** 原订单编号。 */ private Long orderId;
    /** 申请买家编号。 */ private Long buyerId;
    /** 申请说明。 */ private String description;
    /** 凭证编号JSON。 */ private String imageIds;
    /** 处理状态。 */ private String status;
    /** 系统退款判定依据。 */ private String decisionReason;
    /** 原申请及退款执行时刻。 */ private LocalDateTime createdAt;
    /** 退款完成时刻。 */ private LocalDateTime finishedAt;
}
