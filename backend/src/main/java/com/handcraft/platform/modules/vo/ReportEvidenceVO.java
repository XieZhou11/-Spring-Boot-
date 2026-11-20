package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;
import java.util.List;

/** 举报补证及处置异议时间线条目。 */
public record ReportEvidenceVO(
        /** 证据编号。 */ String id,
        /** 提交人编号。 */ String submitterId,
        /** 补充或异议。 */ String evidenceType,
        /** 文字内容。 */ String content,
        /** 图片编号。 */ List<String> imageIds,
        /** 提交时间。 */ OffsetDateTime createdAt) {}
