package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Supplier;
import org.slf4j.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

/** 模拟结算执行：到期待结算订单在锁内重检后同事务落地结算流水、状态、系统日志及双方通知。 */
@Service
public class OrderSettlementServiceImpl implements OrderSettlementService {
    private static final Logger LOGGER=LoggerFactory.getLogger(OrderSettlementServiceImpl.class);
    private final TradeOrderMapper orders;
    private final OrderFulfillmentMapper fulfillment;
    private final OrderPaymentMapper payments;
    private final CustomRequestMapper requests;
    private final CustomRequestPolicyService policy;
    private final ConversationService conversations;
    private final OperationLogService logs;
    private final PayeeSnapshotService payees;
    private final NotificationService notifications;
    private final TransactionTemplate transaction;
    public OrderSettlementServiceImpl(TradeOrderMapper orders,OrderFulfillmentMapper fulfillment,OrderPaymentMapper payments,
            CustomRequestMapper requests,CustomRequestPolicyService policy,ConversationService conversations,
            OperationLogService logs,PayeeSnapshotService payees,NotificationService notifications,PlatformTransactionManager manager){
        this.orders=orders;this.fulfillment=fulfillment;this.payments=payments;this.requests=requests;this.policy=policy;
        this.conversations=conversations;this.logs=logs;this.payees=payees;this.notifications=notifications;
        transaction=new TransactionTemplate(manager);
        transaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    /** 每单独立事务且用键集遍历；单笔失败仅记录日志，不阻塞更高编号订单的结算。 */
    @Override
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    public void scanDue(){
        try{long after=0;while(true){var batch=fulfillment.dueSettlements(after,policy.now());if(batch.isEmpty())break;
            for(Long id:batch){after=id;try{transaction.executeWithoutResult(status->run("订单模拟结算",id,()->{settleLocked(id);return null;}));}
                catch(RuntimeException failure){LOGGER.error("订单模拟结算失败：stage=单笔事务, orderId={}",id,SafeLog.exception(failure));}}
        }}catch(RuntimeException failure){LOGGER.error("订单模拟结算失败：stage=键集扫描",SafeLog.exception(failure));}
    }

    /** 锁序：账号升序→需求→订单→退款→结算→会话；全部条件在锁内重检，不信任扫描结果。 */
    private void settleLocked(Long orderId){
        var initial=orders.find(orderId);if(initial==null)return;
        policy.lockUsers(initial.getBuyerId(),initial.getCreatorId());
        requests.lock(initial.getRequestId());
        var order=orders.lock(orderId);
        // 退款申请行锁先于结算行锁；存在 WAIT_ADMIN 申请时必须等管理员结论，不得抢先结算。
        var refund=fulfillment.pending(orderId);
        var settlement=fulfillment.lockSettlement(orderId);
        var now=policy.now().truncatedTo(ChronoUnit.MILLIS);
        if(settlement==null||!"PENDING".equals(settlement.getStatus())){LOGGER.info("订单模拟结算跳过：stage=状态核验, orderId={}, status={}",orderId,settlement==null?"无记录":settlement.getStatus());return;}
        if(refund!=null||"AFTER_SALE".equals(order.getStatus())){LOGGER.info("订单模拟结算跳过：stage=售后互斥, orderId={}",orderId);return;}
        if(!"COMPLETED".equals(order.getStatus())||order.getOriginalCompletedAt()==null)throw conflict("订单尚未完成，不能结算");
        if(now.isBefore(order.getOriginalCompletedAt().plusDays(7)))throw conflict("订单尚未满七天完成窗口，不能结算");
        // 结算前校验原快照三键，损坏快照按数据异常拒绝，避免结算后资金记录页无法解密。
        if(!payees.parse(settlement.getPayeeSnapshot()).valid())throw conflict("订单收款快照缺少必要字段，不能结算");
        var payment=payments.payment(orderId);
        // 三方金额核对：原实付、订单成交金额与结算快照必须一致，防止快照被篡改后结算。
        if(payment==null||payment.getAmount().compareTo(order.getTotalAmount())!=0||payment.getAmount().compareTo(settlement.getPaidAmount())!=0)throw conflict("订单金额与结算记录不一致，不能结算");
        if(fulfillment.settlementFlowForOrder(orderId)!=null)throw conflict("订单已存在成功结算流水，不能重复结算");
        var flow=new FundFlow();flow.setFlowNo(UUID.randomUUID().toString().replace("-",""));flow.setOrderId(orderId);
        flow.setFlowType("SETTLEMENT");flow.setAmount(settlement.getPaidAmount());flow.setResult("SUCCESS");
        flow.setIdempotencyKey("SETTLEMENT:ORDER:"+orderId);flow.setOccurredAt(now);
        fulfillment.settlementFlow(flow);
        if(fulfillment.markSettled(orderId,flow.getId(),now)!=1)throw conflict("结算状态已变化，不能结算");
        // 系统动作日志沿用统一 OperationLogService 通道；原因列为空表示定时扫描自动结算。
        logs.record(null,false,"ORDER",orderId,"SETTLEMENT","PENDING","SETTLED",null,Map.of("flowId",flow.getId().toString(),"amount",settlement.getPaidAmount().toPlainString()));
        // 双方收到结算结果，金额仅进入创作者通知。
        notifications.settlementChanged(order, "SETTLEMENT_DONE", orderId, settlement.getPaidAmount());
        conversations.orderChanged(order);
        LOGGER.info("订单模拟结算结果已准备：orderId={}, flowId={}, stage=资金及状态同事务",orderId,flow.getId());
    }

    private <T>T run(String name,Long orderId,Supplier<T> work){
        return BusinessLog.run(LOGGER,name,null,()->{try{return work.get();}
            catch(BusinessException e){LOGGER.warn("{}拒绝：stage=锁后业务校验, orderId={}, reason={}",name,orderId,e.getMessage());throw e;}
            catch(RuntimeException e){LOGGER.error("{}异常：stage=原子持久化, orderId={}",name,orderId,SafeLog.exception(e));throw e;}});
    }
    private static BusinessException conflict(String reason){return new BusinessException(CommonErrorCode.CONFLICT,reason);}
}
