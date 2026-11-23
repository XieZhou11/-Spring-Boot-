package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;
import java.util.List;

/** 内容举报当前记录，targetSummary 为被举报对象摘要。 */
public record ContentReportVO(
        /** 举报编号。 */ String id,
        /** WORK/COMMENT/CREATOR_PROFILE/REVIEW。 */ String targetType,
        /** 被举报对象编号。 */ String targetId,
        /** 被举报对象摘要（标题、评论节选或昵称）。 */ String targetSummary,
        /** 举报理由编码。 */ String reasonCode,
        /** 初次说明。 */ String description,
        /** 初次证据图片编号。 */ List<String> imageIds,
        /** PENDING 或 PROCESSED。 */ String status,
        /** 最近结论：NOT_UPHELD 或 ACTION_TAKEN。 */ String latestResult,
        /** 最近处置理由（来自操作日志）。 */ String decisionReason,
        /** 初次提交时间。 */ OffsetDateTime createdAt,
        /** 最近处理时间。 */ OffsetDateTime lastProcessedAt) {}
