package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.dto.OrderNoStartRefundDTO;
/** 未开工超时退款独立维护资金事务，普通售后另行实现。 */
public interface OrderNoStartRefundService {
    /** 满四十八小时且仍未开工时原子保存申请、依据、原实付全额退款与取消待结算；成功重试返回false。 */
    boolean refund(Long userId,Long orderId,OrderNoStartRefundDTO input);
}
