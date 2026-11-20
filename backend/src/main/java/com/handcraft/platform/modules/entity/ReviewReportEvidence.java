package com.handcraft.platform.modules.entity;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/** 举报的补充证据或处置异议记录。 */
@Getter @Setter
public class ReviewReportEvidence {
    /** 证据编号。 */ private Long id;
    /** 举报编号。 */ private Long reportId;
    /** 提交人编号。 */ private Long submitterId;
    /** SUPPLEMENT 或 OBJECTION。 */ private String evidenceType;
    /** 文字说明。 */ private String content;
    /** 证据图片 JSON。 */ private String imageIds;
    /** 提交时间。 */ private LocalDateTime createdAt;
}
