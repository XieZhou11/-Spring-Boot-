package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;

/** @param flowNo 模拟支付流水号
 * @param amount 实付金额，两位十进制字符串
 * @param result 模拟支付结果
 * @param occurredAt 原成功支付时间
 * @param termsVersion 原付款时确认的条款版本
 * @param termsText 原付款时确认的完整条款 */
public record OrderPaymentVO(String flowNo,String amount,String result,OffsetDateTime occurredAt,String termsVersion,String termsText) {}
