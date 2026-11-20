package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.BusinessException;
import com.handcraft.platform.common.exception.CommonErrorCode;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.entity.TradeOrder;
import com.handcraft.platform.modules.mapper.TradeOrderMapper;
import com.handcraft.platform.modules.service.NotificationService;
import com.handcraft.platform.modules.service.OperationLogService;
import com.handcraft.platform.modules.service.OrderService;
import com.handcraft.platform.modules.service.PublicationConsentService;
import com.handcraft.platform.modules.vo.OrderVO;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.TreeSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 授权状态、操作历史和持久化通知在订单行锁内原子更新。 */
@Service
public class PublicationConsentServiceImpl implements PublicationConsentService {
    private static final Logger LOGGER=LoggerFactory.getLogger(PublicationConsentServiceImpl.class);
    private static final ZoneId BEIJING=ZoneId.of("Asia/Shanghai");
    private final TradeOrderMapper orders;
    private final com.handcraft.platform.modules.mapper.UserAccountMapper users;
    private final OperationLogService logs;
    private final NotificationService notifications;
    private final OrderService orderService;
    private final Clock clock;

    public PublicationConsentServiceImpl(TradeOrderMapper orders,com.handcraft.platform.modules.mapper.UserAccountMapper users,
            OperationLogService logs,NotificationService notifications,OrderService orderService,Clock clock) {
        this.orders=orders;this.users=users;this.logs=logs;this.notifications=notifications;this.orderService=orderService;this.clock=clock;
    }

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public OrderVO request(Long userId,Long orderId) {
        return BusinessLog.run(LOGGER,"定制成品公开授权申请",userId,()->{
            TradeOrder initial=orders.find(orderId);if(initial==null||!userId.equals(initial.getCreatorId())||!"CUSTOM".equals(initial.getOrderType()))throw missing();
            lockUsers(initial);TradeOrder order=orders.lock(orderId);if(order==null||!userId.equals(order.getCreatorId())||!"CUSTOM".equals(order.getOrderType()))throw missing();
            if(!"COMPLETED".equals(order.getStatus())||order.getOriginalCompletedAt()==null)throw conflict("仅已完成的定制订单可以申请公开成品案例");
            if(!"NONE".equals(order.getPublicationConsentStatus()))return orderService.detail(userId,orderId);
            LocalDateTime now=now();order.setExpectedConsentStatus(order.getPublicationConsentStatus());order.setPublicationConsentStatus("PENDING");order.setPublicationRequestedAt(now);
            if(orders.updatePublicationConsent(order)!=1)throw conflict("授权状态已变化，请刷新订单后重试");
            logs.record(userId,false,"ORDER_PUBLICATION",orderId,"PUBLICATION_REQUESTED","NONE","PENDING",null,Map.of("occurredAt",now.toString()));
            notifications.tradeChanged(order.getBuyerId(),"PUBLICATION_REQUESTED","ORDER",orderId,order.getRequestId());
            afterCommit("定制成品公开授权申请已提交",order);
            return orderService.detail(userId,orderId);
        });
    }

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public OrderVO respond(Long userId,Long orderId,String decision) {
        return BusinessLog.run(LOGGER,"定制成品公开授权回复",userId,()->{
            TradeOrder initial=orders.find(orderId);if(initial==null||!userId.equals(initial.getBuyerId())||!"CUSTOM".equals(initial.getOrderType()))throw missing();
            lockUsers(initial);TradeOrder order=orders.lock(orderId);if(order==null||!userId.equals(order.getBuyerId())||!"CUSTOM".equals(order.getOrderType()))throw missing();
            if(!"PENDING".equals(order.getPublicationConsentStatus()))return orderService.detail(userId,orderId);
            if(!"APPROVED".equals(decision)&&!"REJECTED".equals(decision))throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"授权决定无效");
            LocalDateTime now=now();order.setExpectedConsentStatus(order.getPublicationConsentStatus());order.setPublicationConsentStatus(decision);order.setPublicationRespondedAt(now);
            if(orders.updatePublicationConsent(order)!=1)throw conflict("授权状态已变化，请刷新订单后重试");
            logs.record(userId,false,"ORDER_PUBLICATION",orderId,"APPROVED".equals(decision)?"PUBLICATION_APPROVED":"PUBLICATION_REJECTED","PENDING",decision,null,Map.of("occurredAt",now.toString()));
            notifications.tradeChanged(order.getCreatorId(),"PUBLICATION_"+decision,"ORDER",orderId,order.getRequestId());
            afterCommit("定制成品公开授权回复已提交：decision="+decision,order);
            return orderService.detail(userId,orderId);
        });
    }

    private void lockUsers(TradeOrder order){new TreeSet<>(java.util.List.of(order.getBuyerId(),order.getCreatorId())).forEach(users::lockById);}
    /** 事务业务只能在提交后记录成功，避免回滚时留下误导日志。 */
    private void afterCommit(String message,TradeOrder order){TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){LOGGER.info("{}：orderId={}, creatorId={}, buyerId={}",message,order.getId(),order.getCreatorId(),order.getBuyerId());}});}
    private LocalDateTime now(){return LocalDateTime.ofInstant(clock.instant(),BEIJING);}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
    private static BusinessException conflict(String message){return new BusinessException(CommonErrorCode.CONFLICT,message);}
}
