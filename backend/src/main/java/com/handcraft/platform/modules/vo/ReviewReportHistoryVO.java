package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;
import java.util.Map;

/** 评价举报每次处理及更正的只追加审计记录。 */
public record ReviewReportHistoryVO(
        /** 操作记录编号。 */ String id,
        /** 管理员编号。 */ String operatorId,
        /** DECIDE 或 CORRECT。 */ String action,
        /** 处理前举报结果。 */ String beforeStatus,
        /** 处理后举报结果。 */ String afterStatus,
        /** 本次核查理由。 */ String reason,
        /** 本次评价状态变化。 */ Map<String,Object> detail,
        /** 操作时间。 */ OffsetDateTime createdAt) {}
