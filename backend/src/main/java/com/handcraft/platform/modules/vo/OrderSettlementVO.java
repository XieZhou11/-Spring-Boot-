package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;

/** @param paidAmount 原实付及应结算金额
 * @param status 结算状态
 * @param maskedPayee 从原收款快照生成的脱敏姓名及账号
 * @param settledAt 模拟结算时间，仅已结算记录存在 */
public record OrderSettlementVO(String paidAmount,String status,String maskedPayee,OffsetDateTime settledAt) {}
