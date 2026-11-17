package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.AwardDTO;
import com.handcraft.platform.modules.dto.OrderQueryDTO;
import com.handcraft.platform.modules.vo.*;

/** 定标建单与待付款订单管理，金额及地址在服务端保存快照。 */
public interface OrderService {
    /** 原子选定方案、创建唯一订单并关联会话。 */
    Creation award(Long userId,Long requestId,AwardDTO input);
    /** 查询当前账号买入或承接的订单列表。 */
    PageVO<OrderVO> list(Long userId,OrderQueryDTO query);
    /** 按订单双方关系读取详情并裁剪隐私。 */
    OrderVO detail(Long userId,Long orderId);
    /** 买家取消待付款订单，重复请求复用已取消结果。 */
    OrderVO cancel(Long userId,Long orderId);
    /** @param order 订单结果 @param created 是否首次建单 */
    record Creation(OrderVO order,boolean created) {}
}
