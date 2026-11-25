package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.entity.*;
import java.time.LocalDateTime;
import java.util.*;
/** 调用方负责资格与上游锁，公共资金执行与调用方事务同生共灭。 */
public interface OrderRefundExecutionService {
    /** 取得结算→定制节点→会话锁并核对原支付；必须在任何凭证文件锁之前调用。 */ Context lockContext(TradeOrder order);
    /** 在持有完整顺序锁的事务内执行全额退款；现货没有原需求。 */ void execute(Long actor,boolean admin,CustomRequest request,TradeOrder order,RefundApplication refund,Context context,LocalDateTime now,String action,Map<String,Object> audit);
    /** @param settlement 已锁定原结算 @param nodes 已锁定的定制节点，现货为空列表 @param conversation 已锁定订单会话 @param payment 原成功付款 */
    record Context(OrderSettlement settlement,List<OrderProgressNode> nodes,Conversation conversation,FundFlow payment) {}
}
