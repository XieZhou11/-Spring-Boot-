package com.handcraft.platform.modules.serviceImpl;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import java.time.LocalDateTime;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
/** MANDATORY公共资金事务：原支付金额不接受客户端输入，且保留全部原账户快照和履约证据。 */
@Service
public class OrderRefundExecutionServiceImpl implements OrderRefundExecutionService {
    private static final Logger LOGGER=LoggerFactory.getLogger(OrderRefundExecutionServiceImpl.class);
    private final OrderFulfillmentMapper fulfillment;private final OrderPaymentMapper payments;private final ConversationMapper chats;
    private final RefundApplicationMapper refunds;private final QuoteLifecycleService lifecycle;private final OperationLogService logs;
    private final NotificationService notifications;private final ConversationService conversations;
    public OrderRefundExecutionServiceImpl(OrderFulfillmentMapper fulfillment,OrderPaymentMapper payments,ConversationMapper chats,RefundApplicationMapper refunds,QuoteLifecycleService lifecycle,OperationLogService logs,NotificationService notifications,ConversationService conversations){this.fulfillment=fulfillment;this.payments=payments;this.chats=chats;this.refunds=refunds;this.lifecycle=lifecycle;this.logs=logs;this.notifications=notifications;this.conversations=conversations;}
    @Transactional(propagation=Propagation.MANDATORY)
    public Context lockContext(TradeOrder order){
        var settlement=fulfillment.lockSettlement(order.getId());var payment=payments.payment(order.getId());validate(order,settlement,payment);
        var nodes=fulfillment.lockNodes(order.getId());if(nodes.size()!=5)throw conflict("订单制作计划不完整");
        var initial=chats.byRequest(order.getRequestId(),order.getCreatorId());if(initial==null)throw conflict("订单关联会话不存在");var chat=chats.lock(initial.getId());
        if(!Objects.equals(chat.getOrderId(),order.getId())||!Objects.equals(chat.getBuyerId(),order.getBuyerId())||!Objects.equals(chat.getCreatorId(),order.getCreatorId()))throw conflict("订单会话关联不一致");return new Context(settlement,nodes,chat,payment);
    }
    @Transactional(propagation=Propagation.MANDATORY,rollbackFor=Exception.class)
    public void execute(Long actor,boolean admin,CustomRequest request,TradeOrder order,RefundApplication refund,Context context,LocalDateTime now,String action,Map<String,Object> audit){BusinessLog.run(LOGGER,"订单原子退款执行",actor,()->{
        if(request==null||refund==null||context==null||!Objects.equals(order.getRequestId(),request.getId())||!Objects.equals(refund.getOrderId(),order.getId())||!Objects.equals(context.settlement().getOrderId(),order.getId())||!Objects.equals(context.payment().getOrderId(),order.getId())||!Objects.equals(context.conversation().getOrderId(),order.getId()))throw conflict("退款上下文关联异常");
        validate(order,context.settlement(),context.payment());String before=order.getStatus();
        var flow=new FundFlow();flow.setOrderId(order.getId());flow.setFlowNo(UUID.randomUUID().toString().replace("-",""));flow.setAmount(context.payment().getAmount());flow.setOccurredAt(now);flow.setIdempotencyKey("REFUND:ORDER:"+order.getId());fulfillment.refundFlow(flow,refund.getId());
        if(fulfillment.cancelSettlement(order.getId(),now)!=1)throw conflict("结算状态已变化，退款回滚");
        if("WAIT_ADMIN".equals(refund.getStatus())){refund.setStatus("REFUNDED");refund.setFinishedAt(now);if(refunds.updateTerminal(refund)!=1)throw conflict("退款申请状态已变化");}
        else if(!"NO_START_TIMEOUT".equals(refund.getApplicationType())||!"REFUNDED".equals(refund.getStatus()))throw conflict("退款申请状态异常");
        order.setStatus("REFUNDED");order.setUpdatedAt(now);if(fulfillment.updateOrder(order)!=1)throw conflict("订单状态已变化");lifecycle.state(request,"CLOSED",actor);
        var detail=new LinkedHashMap<String,Object>();if(audit!=null)detail.putAll(audit);detail.put("occurredAt",now.toString());detail.put("refundId",refund.getId().toString());detail.put("paymentFlowNo",context.payment().getFlowNo());detail.put("refundFlowNo",flow.getFlowNo());
        logs.record(actor,admin,"ORDER",order.getId(),action,before,"REFUNDED",refund.getDecisionReason(),detail);
        if("NO_START_TIMEOUT".equals(refund.getApplicationType())){notifications.fulfillmentChanged(order.getBuyerId(),"ORDER_NO_START_REFUNDED",refund.getId(),order.getId(),order.getRequestId());notifications.fulfillmentChanged(order.getCreatorId(),"ORDER_NO_START_REFUNDED",refund.getId(),order.getId(),order.getRequestId());}
        else {notifications.refundChanged(order.getBuyerId(),"REFUND_APPROVED",refund.getId(),order.getId(),order.getRequestId());notifications.refundChanged(order.getCreatorId(),"REFUND_APPROVED",refund.getId(),order.getId(),order.getRequestId());}
        notifications.refundChanged(order.getCreatorId(),"SETTLEMENT_CANCELLED",refund.getId(),order.getId(),order.getRequestId());conversations.orderChanged(order);
        LOGGER.info("订单全额退款结果已准备：orderId={}, refundId={}, stage=资金及状态同事务",order.getId(),refund.getId());return null;
    });}
    private void validate(TradeOrder order,OrderSettlement settlement,FundFlow payment){if(payment==null||settlement==null||!"PENDING".equals(settlement.getStatus())||fulfillment.refundFlowForOrder(order.getId())!=null)throw conflict("原支付、待结算或成功退款状态异常");if(payment.getAmount().compareTo(order.getTotalAmount())!=0||payment.getAmount().compareTo(settlement.getPaidAmount())!=0)throw conflict("订单成交、原成功支付与待结算金额不一致，请联系平台处理");}
    private static BusinessException conflict(String message){return new BusinessException(CommonErrorCode.CONFLICT,message);}
}
