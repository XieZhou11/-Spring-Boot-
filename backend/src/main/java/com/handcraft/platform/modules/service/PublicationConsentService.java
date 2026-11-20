package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.vo.OrderVO;

/** 定制成品公开授权由创作者申请、订单买家明确回复。 */
public interface PublicationConsentService {
    /** 创作者申请公开本笔已完成定制订单的成品案例。 */
    OrderVO request(Long userId, Long orderId);
    /** 本笔订单买家通过按钮同意或拒绝公开。 */
    OrderVO respond(Long userId, Long orderId, String decision);
}
