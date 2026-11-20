package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;

/** 创作者可选择关联案例的已授权定制订单摘要，不含地址或聊天内容。 */
public record PublicationOrderOptionVO(
        /** 来源订单编号。 */ String orderId,
        /** 定制订单标题快照。 */ String title,
        /** 成品完成时间。 */ OffsetDateTime completedAt,
        /** 买家授权时间。 */ OffsetDateTime consentedAt) {}
