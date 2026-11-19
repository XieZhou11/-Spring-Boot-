package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.dto.*;
/** 订单履约写入只返回是否首次创建，控制器提交后读取一致详情。 */
public interface OrderFulfillmentService {
    /** 本单创作者确认开工并解锁首节点。 */ boolean start(Long userId,Long orderId);
    /** 按顺序完成前四节点的首次图文。 */ boolean checkIn(Long userId,Long orderId,Long nodeId,OrderCheckInDTO input);
    /** 仅打样节点可记录理由跳过。 */ boolean skip(Long userId,Long orderId,Long nodeId,OrderSkipDTO input);
    /** 履约期间为已处理节点追加图文，不覆盖原文。 */ boolean supplement(Long userId,Long orderId,Long nodeId,OrderSupplementDTO input);
    /** 第五节点图文与发货原子生效。 */ boolean ship(Long userId,Long orderId,OrderShipmentDTO input);
    /** 收货前更正运单并保存前后值，不修改物流时间。 */ void correctTracking(Long userId,Long orderId,OrderTrackingDTO input);
    /** 买家首次确认收货，保留原完成时间。 */ boolean receive(Long userId,Long orderId);
}
