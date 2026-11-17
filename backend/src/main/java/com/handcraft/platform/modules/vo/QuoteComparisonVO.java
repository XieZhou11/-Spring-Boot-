package com.handcraft.platform.modules.vo;

import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * @param requestId 需求编号
 * @param requestTitle 需求标题
 * @param expectedShipDate 买家期望发货日
 * @param items 最多五份有效方案
 * @param activeCount 有效报价数量
 * @param limit 需求有效报价上限
 * @param canAward 需求是否允许买家定标
 * @param awardDisabledReason 定标不可用原因
 * @param serverDate 服务端北京日期
 */
public record QuoteComparisonVO(String requestId, String requestTitle, LocalDate expectedShipDate, List<QuoteVO> items, long activeCount, int limit, boolean canAward, String awardDisabledReason, LocalDate serverDate) {}
