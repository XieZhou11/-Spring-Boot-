package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.AdminOrderQueryDTO;
import com.handcraft.platform.modules.vo.AdminOrderVO;
import com.handcraft.platform.modules.vo.PageVO;

/** 管理员订单综合只读检索。 */
public interface AdminOrderQueryService {
    /** 按订单编号、状态、类型、创建时间和金额分页查询。 */ PageVO<AdminOrderVO> list(Long admin,AdminOrderQueryDTO query);
    /** 查询交易快照、资金、履约、会话及制作记录。 */ AdminOrderDetailVO detail(Long admin,Long orderId);
}
