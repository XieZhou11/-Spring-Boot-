package com.handcraft.platform.modules.entity;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 业务关系限定的一对一会话，订单结束后继续保留沟通。 */
@Getter @Setter
public class Conversation {
    /** 会话编号。 */
    private Long id;
    /** 固定买家编号。 */
    private Long buyerId;
    /** 固定创作者编号。 */
    private Long creatorId;
    /** 原需求编号。 */
    private Long requestId;
    /** 已形成的订单编号。 */
    private Long orderId;
    /** 未成单或落选会话的归档时间。 */
    private LocalDateTime archivedAt;
    /** 归档原因。 */
    private String archiveReason;
    /** 最新消息序号。 */
    private Long lastMessageSeq;
    /** 买家已读序号。 */
    private Long buyerReadSeq;
    /** 创作者已读序号。 */
    private Long creatorReadSeq;
    /** 买家发送冷却截止时间。 */
    private LocalDateTime buyerCooldownUntil;
    /** 创作者发送冷却截止时间。 */
    private LocalDateTime creatorCooldownUntil;
    /** 最近消息时间，无消息时为创建时间。 */
    private LocalDateTime lastMessageAt;
    /** 创建时间。 */
    private LocalDateTime createdAt;
    /** 更新时间。 */
    private LocalDateTime updatedAt;
}
