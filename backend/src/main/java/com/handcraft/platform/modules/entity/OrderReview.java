package com.handcraft.platform.modules.entity;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/** 订单评价实体，不生成包含评价正文的 toString。 */
@Getter @Setter
public class OrderReview {
    /** 评价编号。 */ private Long id;
    /** 唯一关联订单编号。 */ private Long orderId;
    /** 评价买家编号。 */ private Long buyerId;
    /** 被评价创作者编号。 */ private Long creatorId;
    /** 总体星级。 */ private Integer rating;
    /** 评价文字。 */ private String content;
    /** 评价图片 JSON。 */ private String imageIds;
    /** 公开治理状态。 */ private String moderationStatus;
    /** 提交时间。 */ private LocalDateTime createdAt;
}
