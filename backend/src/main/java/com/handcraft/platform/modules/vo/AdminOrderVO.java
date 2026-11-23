package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;
/** 管理员综合订单列表行。 */
public record AdminOrderVO(
        /** 订单编号。 */ String orderId,
        /** 唯一业务订单号。 */ String orderNo,
        /** 订单类型 STOCK 或 CUSTOM。 */ String orderType,
        /** 当前履约状态。 */ String status,
        /** 订单标题快照。 */ String title,
        /** 成交金额快照。 */ String amount,
        /** 买家编号。 */ String buyerId,
        /** 买家昵称。 */ String buyerNickname,
        /** 创作者编号。 */ String creatorId,
        /** 创作者昵称。 */ String creatorNickname,
        /** 订单创建时间。 */ OffsetDateTime createdAt) {}
