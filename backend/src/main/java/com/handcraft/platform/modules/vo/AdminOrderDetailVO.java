package com.handcraft.platform.modules.vo;

import java.util.List;
import java.util.Map;

/** 管理员只读订单详情，集中呈现交易快照、资金流水、会话和制作记录。 */
public record AdminOrderDetailVO(
        /** 订单基础及履约状态快照。 */ AdminRefundOrderVO order,
        /** 本单成功模拟资金流水。 */ List<Map<String,Object>> fundFlows,
        /** 最近的会话消息，不推进参与方已读游标。 */ List<ChatMessageVO> messages) {}
