package com.handcraft.platform.modules.entity;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/** 评价举报当前记录。 */
@Getter @Setter
public class ReviewReport {
    /** 举报编号。 */ private Long id;
    /** 举报人编号。 */ private Long reporterId;
    /** 当前仅为评价举报。 */ private String targetType;
    /** 被举报评价编号。 */ private Long targetId;
    /** 举报理由编码。 */ private String reasonCode;
    /** 初次说明。 */ private String description;
    /** 初次图片 JSON。 */ private String imageIds;
    /** 待处理或已处理。 */ private String status;
    /** 最近处理结论。 */ private String latestResult;
    /** 处理管理员编号。 */ private Long handlerId;
    /** 最近处理时间。 */ private LocalDateTime lastProcessedAt;
    /** 初次创建时间。 */ private LocalDateTime createdAt;
}
