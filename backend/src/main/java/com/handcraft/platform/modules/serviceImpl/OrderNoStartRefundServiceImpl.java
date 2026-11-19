package com.handcraft.platform.modules.serviceImpl;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.dto.OrderNoStartRefundDTO;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
/** 资金、退款依据和履约终止共用事务，按用户→需求→订单→退款→结算→节点→会话→文件锁序与开工互斥。 */
@Service
public class OrderNoStartRefundServiceImpl implements OrderNoStartRefundService {
    private static final Logger LOGGER=LoggerFactory.getLogger(OrderNoStartRefundServiceImpl.class);
    private final TradeOrderMapper orders;private final OrderFulfillmentMapper fulfillment;private final OrderPaymentMapper payments;
    private final CustomRequestMapper requests;private final CustomRequestPolicyService policy;private final ConversationMapper conversationMapper;
    private final ConversationService conversations;private final OrderImageService images;private final QuoteLifecycleService lifecycle;
    private final NotificationService notifications;private final OperationLogService logs;private final ObjectMapper json;
    public OrderNoStartRefundServiceImpl(TradeOrderMapper orders,OrderFulfillmentMapper fulfillment,OrderPaymentMapper payments,
            CustomRequestMapper requests,CustomRequestPolicyService policy,ConversationMapper conversationMapper,
            ConversationService conversations,OrderImageService images,QuoteLifecycleService lifecycle,NotificationService notifications,
            OperationLogService logs,ObjectMapper json){
        this.orders=orders;this.fulfillment=fulfillment;this.payments=payments;this.requests=requests;this.policy=policy;
        this.conversationMapper=conversationMapper;this.conversations=conversations;this.images=images;this.lifecycle=lifecycle;
        this.notifications=notifications;this.logs=logs;this.json=json;
    }
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public boolean refund(Long actor,Long orderId,OrderNoStartRefundDTO input){return BusinessLog.run(LOGGER,"未开工无责退款",actor,()->{
        try{
            var initial=orders.find(orderId);buyer(actor,initial);policy.lockUsers(initial.getBuyerId(),initial.getCreatorId());
            var request=requests.lock(initial.getRequestId());var order=orders.lock(orderId);buyer(actor,order);policy.user(actor);
            if(request==null||!Objects.equals(request.getBuyerId(),order.getBuyerId()))throw conflict("订单与原需求关联不一致");
            boolean pending=fulfillment.pending(orderId)!=null;
            // 取时点在用户、需求及订单竞争锁之后，避免等待期间跨过48小时仍错误拒绝。
            var now=policy.now().truncatedTo(ChronoUnit.MILLIS);var prior=fulfillment.refunded(orderId);
            if(prior!=null){if(!Objects.equals(prior.getDescription(),input.getDescription())||!ids(prior.getImageIds()).equals(input.getImageIds()))throw conflict("原退款申请已生效，不能覆盖说明或凭证");return false;}
            if(pending||!"IN_TRADE".equals(request.getStatus())||!"PAID".equals(order.getStatus())||order.getStartedAt()!=null||order.getPaidAt()==null||now.isBefore(order.getPaidAt().plusHours(48)))throw conflict("仅支付满48小时且仍未开工的定制订单可无责退款");
            var payment=payments.payment(orderId);var settlement=fulfillment.lockSettlement(orderId);
            if(payment==null||settlement==null||!"PENDING".equals(settlement.getStatus())||fulfillment.refundFlowForOrder(orderId)!=null)throw conflict("原支付或待结算状态异常，不能退款");
            if(payment.getAmount().compareTo(order.getTotalAmount())!=0||payment.getAmount().compareTo(settlement.getPaidAmount())!=0)throw conflict("订单成交、原成功支付与待结算金额不一致，请联系平台处理");
            var nodes=fulfillment.lockNodes(orderId);if(nodes.size()!=5)throw conflict("订单制作计划不完整");
            var initialConversation=conversationMapper.byRequest(order.getRequestId(),order.getCreatorId());if(initialConversation==null)throw conflict("订单关联会话不存在");
            var conversation=conversationMapper.lock(initialConversation.getId());
            if(!Objects.equals(orderId,conversation.getOrderId())||!Objects.equals(actor,conversation.getBuyerId()))throw conflict("订单会话关联不一致");
            images.validate(actor,orderId,"REFUND",input.getImageIds());
            if(input.getDescription().strip().length()<20)throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"退款说明至少20字");
            LOGGER.info("无责退款关键校验完成：orderId={}, stage=锁后48小时及原支付金额一致性",orderId);
            var refund=new RefundApplication();refund.setOrderId(orderId);refund.setBuyerId(actor);refund.setDescription(input.getDescription());refund.setImageIds(json.writeValueAsString(input.getImageIds()));
            refund.setDecisionReason("系统核验：原支付时间="+order.getPaidAt()+"；核验时间="+now+"；支付已满48小时、状态PAID、实际未开工；按原成功支付流水全额退回。");
            refund.setCreatedAt(now);refund.setFinishedAt(now);fulfillment.insertRefund(refund);
            var flow=new FundFlow();flow.setOrderId(orderId);flow.setFlowNo(UUID.randomUUID().toString().replace("-",""));flow.setAmount(payment.getAmount());flow.setOccurredAt(now);flow.setIdempotencyKey("REFUND:ORDER:"+orderId);fulfillment.refundFlow(flow,refund.getId());
            if(fulfillment.cancelSettlement(orderId,now)!=1)throw conflict("结算状态已变化，退款回滚");
            order.setStatus("REFUNDED");order.setUpdatedAt(now);if(fulfillment.updateOrder(order)!=1)throw conflict("订单状态已变化");lifecycle.state(request,"CLOSED",actor);
            logs.record(actor,false,"ORDER",orderId,"NO_START_REFUND","PAID","REFUNDED",null,Map.of("occurredAt",now.toString(),"refundId",refund.getId().toString(),"paymentFlowNo",payment.getFlowNo(),"refundFlowNo",flow.getFlowNo()));
            notifications.fulfillmentChanged(order.getBuyerId(),"ORDER_NO_START_REFUNDED",refund.getId(),orderId,order.getRequestId());
            notifications.fulfillmentChanged(order.getCreatorId(),"ORDER_NO_START_REFUNDED",refund.getId(),orderId,order.getRequestId());conversations.orderChanged(order);
            LOGGER.info("无责退款原子结果已准备：orderId={}, refundId={}, stage=等待事务提交",orderId,refund.getId());return true;
        }catch(BusinessException failure){LOGGER.warn("无责退款拒绝：stage=锁后规则与资金校验, userId={}, orderId={}, reason={}",actor,orderId,failure.getMessage());throw failure;}
        catch(RuntimeException failure){LOGGER.error("无责退款异常：stage=原子退款持久化, userId={}, orderId={}",actor,orderId,SafeLog.exception(failure));throw failure;}
    });}
    private List<String> ids(String raw){return json.readValue(raw,new TypeReference<List<String>>(){});}
    private void buyer(Long actor,TradeOrder order){
        if(order==null||!"CUSTOM".equals(order.getOrderType())||!Objects.equals(actor,order.getBuyerId())&&!Objects.equals(actor,order.getCreatorId()))throw new BusinessException(CommonErrorCode.NOT_FOUND);
        if(!Objects.equals(actor,order.getBuyerId()))throw new BusinessException(CommonErrorCode.FORBIDDEN,"仅订单买家可以申请无责退款");
    }
    private static BusinessException conflict(String text){return new BusinessException(CommonErrorCode.CONFLICT,text);}
}
