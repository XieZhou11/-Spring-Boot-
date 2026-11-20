package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
/** 管理员资金记录行：姓名与收款账号为已审核快照解密后的明文，仅管理员接口返回。 */
public record AdminSettlementVO(String orderId,String orderNo,String title,String orderType,String buyerId,String creatorId,
        String paidAmount,String status,OffsetDateTime settledAt,OffsetDateTime cancelledAt,String realName,String payeeAccount,OffsetDateTime createdAt) {}
