package com.handcraft.platform.modules.vo;

import java.util.List;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * @param id 报价编号
 * @param requestId 所属需求编号
 * @param requestTitle 需求标题
 * @param creatorId 报价作者编号
 * @param creatorNickname 作者昵称
 * @param goodsAmount 报价金额
 * @param durationDays 自然日工期
 * @param proposal 完整方案
 * @param additionalAgreement 补充约定
 * @param imageIds 报价图片编号
 * @param status 有效报价状态
 * @param invalidReason 失效原因
 * @param createdAt 提交时间
 * @param expiresAt 报价截止时间
 * @param estimatedShipDate 按当前日期测算的发货日
 * @param averageRating 一位小数平均星级，无评价为空
 * @param reviewCount 有效评价数
 * @param completedOrderCount 未退款已完成订单数
 * @param owned 是否本人提交
 * @param canWithdraw 是否可撤回
 * @param canAward 当前买家是否可选择
 */
public record QuoteVO(String id, String requestId, String requestTitle, String creatorId, String creatorNickname, String goodsAmount, int durationDays, String proposal, String additionalAgreement, List<String> imageIds, String status, String invalidReason, OffsetDateTime createdAt, OffsetDateTime expiresAt, LocalDate estimatedShipDate, String averageRating, long reviewCount, long completedOrderCount, boolean owned, boolean canWithdraw, boolean canAward) {}
