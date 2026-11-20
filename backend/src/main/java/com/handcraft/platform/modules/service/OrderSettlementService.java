package com.handcraft.platform.modules.service;

/** 模拟结算执行：定时扫描到期待结算订单并同事务落地结算流水、状态与通知。 */
public interface OrderSettlementService {
    /** 扫描到期 PENDING 结算记录，逐单独立事务执行结算；单笔失败不阻断其余订单。 */
    void scanDue();
}
