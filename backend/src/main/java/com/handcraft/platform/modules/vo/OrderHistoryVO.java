package com.handcraft.platform.modules.vo;

import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * @param action 操作类型
 * @param fromStatus 变更前状态
 * @param toStatus 变更后状态
 * @param reason 取消原因
 * @param createdAt 业务发生时间
 */
public record OrderHistoryVO(String action, String fromStatus, String toStatus, String reason, OffsetDateTime createdAt) {}
