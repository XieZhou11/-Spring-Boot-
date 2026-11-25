package com.handcraft.platform.modules.vo;

import java.util.List;

/** 管理员举报核查材料及交易关联。 */
public record ReviewReportDetailVO(
        /** 举报记录。 */ ReviewReportVO report,
        /** 被举报评价。 */ OrderReviewVO review,
        /** 订单编号。 */ String orderId,
        /** 订单对外编号。 */ String orderNo,
        /** 关联会话编号。 */ String conversationId,
        /** 订单两方编号。 */ String buyerId,
        /** 创作者编号。 */ String creatorId,
        /** 历次补充证据和处置异议。 */ List<ReportEvidenceVO> evidence,
        /** 管理员核查时读取的关联订单沟通记录。 */ List<ChatMessageVO> messages,
        /** 举报处理及更正历史。 */ List<ReviewReportHistoryVO> history,
        /** 评价的当前治理状态。 */ String targetState,
        /** 当前管理员可执行的处置或更正。 */ List<String> allowedDecisions,
        /** 举报人可在处理中追加证据。 */ boolean canSupplement,
        /** 评价关联交易双方可提出处置异议。 */ boolean canObjection) {}
