package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;
import java.util.List;

/** 举报详情、处理历史及追加证据。 */
public record ReviewReportVO(
        /** 举报编号。 */ String id,
        /** 被举报评价编号。 */ String reviewId,
        /** 举报人编号。 */ String reporterId,
        /** 举报理由。 */ String reasonCode,
        /** 举报说明。 */ String description,
        /** 举报图片编号。 */ List<String> imageIds,
        /** 当前处理状态。 */ String status,
        /** 最近处理结论。 */ String latestResult,
        /** 处理依据。 */ String decisionReason,
        /** 初次提交时间。 */ OffsetDateTime createdAt,
        /** 最近处理时间。 */ OffsetDateTime processedAt) {}
