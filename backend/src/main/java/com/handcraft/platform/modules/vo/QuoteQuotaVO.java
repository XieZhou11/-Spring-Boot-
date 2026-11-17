package com.handcraft.platform.modules.vo;

import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * @param used 当日已提交次数
 * @param limit 每日限额
 * @param remaining 当日剩余次数
 */
public record QuoteQuotaVO(long used, int limit, long remaining) {}
