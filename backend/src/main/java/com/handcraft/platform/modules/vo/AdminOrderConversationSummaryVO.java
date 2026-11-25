package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;

/** 综合订单详情用于定位售后查证的会话摘要。 */
public record AdminOrderConversationSummaryVO(
        /** 会话编号。 */ String conversationId,
        /** 最后一条消息序号，无消息时为 0。 */ String lastMessageSeq,
        /** 最近消息的发送时间，无消息时为空。 */ OffsetDateTime lastMessageAt,
        /** 会话归档时间，未归档时为空。 */ OffsetDateTime archivedAt) {}
