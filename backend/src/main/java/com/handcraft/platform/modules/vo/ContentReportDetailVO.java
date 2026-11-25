package com.handcraft.platform.modules.vo;

import java.util.List;

/** 内容举报核查详情：目标快照、证据、处置历史及当前用户可执行动作。 */
public record ContentReportDetailVO(
        /** 举报当前记录。 */ ContentReportVO report,
        /** 被处理人用户编号（作品作者、评论作者或被举报创作者）。 */ String ownerId,
        /** 被举报对象摘要。 */ String targetSummary,
        /** 评论举报关联作品编号，其他类型为 null。 */ String workId,
        /** 目标当前状态：ONLINE/OFFLINE、VISIBLE/HIDDEN 或 ACTIVE/PAUSED。 */ String targetState,
        /** 管理员核查评论时查看的完整原文。 */ String originalComment,
        /** 管理员核查评论时可续签的原评论图片编号。 */ List<String> originalCommentImageIds,
        /** 历次补充证据和处置异议。 */ List<ReportEvidenceVO> evidence,
        /** 处置及更正历史。 */ List<ReviewReportHistoryVO> history,
        /** 当前管理员可执行的处置或更正。 */ List<String> allowedDecisions,
        /** 当前用户处理中补充证据资格。 */ boolean canSupplement,
        /** 当前用户对已处理结论提出异议资格。 */ boolean canObjection) {}
