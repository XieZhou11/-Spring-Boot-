package com.handcraft.platform.modules.vo;

import java.util.List;
import java.util.Map;

/** 管理员只读订单详情，集中呈现交易快照、资金流水、会话和制作记录。 */
public record AdminOrderDetailVO(
        /** 订单基础及履约状态快照。 */ AdminRefundOrderVO order,
        /** 本单成功模拟资金流水。 */ List<Map<String,Object>> fundFlows,
        /** 兼容旧调用方的会话字段，固定为空数组。 */ List<ChatMessageVO> messages,
        /** 订单类型 STOCK 或 CUSTOM。 */ String orderType,
        /** 经订单归属校验的会话摘要，未建立会话时为空。 */ AdminOrderConversationSummaryVO conversationSummary,
        /** 待处理申请或唯一可查历史申请编号，无法定位时为空。 */ String refundApplicationId) {}
