package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
/** 创作者收入记录行：金额为应结算金额（等于买家实付），账户仅脱敏文本。 */
public record CreatorSettlementVO(String orderId,String orderNo,String title,String paidAmount,String status,OffsetDateTime settledAt,String maskedPayee) {}
