package com.handcraft.platform.modules.vo;

/** @param paidAmount 原实付及应结算金额
 * @param status 结算状态
 * @param maskedPayee 从原收款快照生成的脱敏姓名及账号 */
public record OrderSettlementVO(String paidAmount,String status,String maskedPayee) {}
