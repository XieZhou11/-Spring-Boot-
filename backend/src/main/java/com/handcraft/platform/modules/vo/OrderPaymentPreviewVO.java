package com.handcraft.platform.modules.vo;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** @param shipDate 最终约定发货日
 * @param shipDeadlineAt 发货日次日零时的排他截止上界
 * @param termsVersion 本次必须确认的支付条款版本
 * @param termsText 完整定制支付条款原文 */
public record OrderPaymentPreviewVO(LocalDate shipDate,OffsetDateTime shipDeadlineAt,String termsVersion,String termsText) {}
