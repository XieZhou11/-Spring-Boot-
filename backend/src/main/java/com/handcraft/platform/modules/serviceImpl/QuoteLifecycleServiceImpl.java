package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.security.NotificationSocketHandler;
import com.handcraft.platform.modules.service.*;
import java.util.*;
import org.slf4j.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.*;

/** 需求行锁内统一维护报价到期、需求状态和未成单会话归档。 */
@Service
public class QuoteLifecycleServiceImpl implements QuoteLifecycleService {
    private static final Logger LOGGER=LoggerFactory.getLogger(QuoteLifecycleServiceImpl.class);
    private final QuoteMapper quotes;
    private final CustomRequestMapper requests;
    private final ConversationMapper conversations;
    private final CustomRequestPolicyService policy;
    private final NotificationService notifications;
    private final OperationLogService logs;
    private final NotificationSocketHandler socket;
    private final TransactionTemplate transaction;

    public QuoteLifecycleServiceImpl(QuoteMapper quotes,CustomRequestMapper requests,ConversationMapper conversations,
            CustomRequestPolicyService policy,NotificationService notifications,OperationLogService logs,
            NotificationSocketHandler socket,PlatformTransactionManager manager) {
        this.quotes=quotes;this.requests=requests;this.conversations=conversations;this.policy=policy;
        this.notifications=notifications;this.logs=logs;this.socket=socket;
        transaction=new TransactionTemplate(manager);transaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public List<Quote> reconcile(CustomRequest request) {
        var history=quotes.lockForRequest(request.getId());
        for(var quote:history)if("ACTIVE".equals(quote.getStatus())&&!policy.now().isBefore(quote.getExpiresAt()))
            invalidate(request,quote,"TIMEOUT",null);
        if(Set.of("OPEN","QUOTING").contains(request.getStatus())) {
            boolean active=history.stream().anyMatch(quote->"ACTIVE".equals(quote.getStatus()));
            if(active)state(request,"QUOTING",null);
            else if(!policy.now().isBefore(request.getNoQuoteExpireAt()))terminate(request,"EXPIRED",null);
            else state(request,"OPEN",null);
        }
        return history;
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void invalidate(CustomRequest request,Quote quote,String reason,Long actorId) {
        if(!"ACTIVE".equals(quote.getStatus()))return;
        quote.setStatus("EXPIRED");quote.setInvalidReason(reason);
        quote.setInvalidatedAt(policy.now());quote.setUpdatedAt(policy.now());
        if(quotes.transition(quote)!=1)throw new BusinessException(CommonErrorCode.CONFLICT,"报价状态已变化");
        logs.record(actorId,false,"QUOTE",quote.getId(),"EXPIRED","ACTIVE","EXPIRED",reason);
        String event="WITHDRAWN".equals(reason)?"QUOTE_WITHDRAWN":"QUOTE_EXPIRED";
        notifications.tradeChanged(request.getBuyerId(),event,"QUOTE",quote.getId(),request.getId());
        notifications.tradeChanged(quote.getCreatorId(),event,"QUOTE",quote.getId(),request.getId());
        LOGGER.info("报价失效已准备：quoteId={}, requestId={}, reason={}",quote.getId(),request.getId(),reason);
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void state(CustomRequest request,String status,Long actorId) {
        if(status.equals(request.getStatus()))return;
        String before=request.getStatus();request.setStatus(status);request.setUpdatedAt(policy.now());
        if(Set.of("CLOSED","EXPIRED").contains(status))request.setClosedAt(policy.now());
        if(requests.update(request)!=1)throw new BusinessException(CommonErrorCode.CONFLICT,"需求状态已变化");
        request.setVersion(request.getVersion()+1);
        logs.record(actorId,false,"CUSTOM_REQUEST",request.getId(),status,before,status,null);
        LOGGER.info("需求状态变更已准备：requestId={}, before={}, after={}",request.getId(),before,status);
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void terminate(CustomRequest request,String status,Long actorId) {
        var history=quotes.lockForRequest(request.getId());
        var now=policy.now();
        // 扫描尚未持久化的到期报价仍按超时失效，关闭不能改写其真实原因。
        for(var quote:history)invalidate(request,quote,"EXPIRED".equals(status)||!now.isBefore(quote.getExpiresAt())?"TIMEOUT":"REQUEST_CLOSED",actorId);
        state(request,status,actorId);
        String event="EXPIRED".equals(status)?"REQUEST_EXPIRED":"REQUEST_CLOSED";
        var related=conversations.forRequest(request.getId());
        related.forEach(conversation->conversations.lock(conversation.getId()));
        conversations.archive(request.getId(),event,policy.now());
        Set<Long> recipients=new TreeSet<>();recipients.add(request.getBuyerId());
        if(request.getInvitedCreatorId()!=null)recipients.add(request.getInvitedCreatorId());
        history.forEach(quote->recipients.add(quote.getCreatorId()));
        related.forEach(conversation->recipients.add(conversation.getCreatorId()));
        recipients.forEach(recipient->notifications.customRequestChanged(recipient,request.getId(),event));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try {for(var conversation:related) {
                    var update=Map.of("type","CONVERSATION_UPDATED","conversationId",conversation.getId().toString());
                    socket.publish(conversation.getBuyerId(),update);socket.publish(conversation.getCreatorId(),update);
                }}catch(RuntimeException failure){LOGGER.error("需求归档推送失败：stage=提交后, requestId={}",request.getId(),SafeLog.exception(failure));}
            }
        });
    }

    /** 每条需求独立重试；GET 仅计算有效状态，由扫描持久化到期。 */
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    public void expireDue() {
        try {for(var requestId:quotes.dueRequests(policy.now())) {
            try {transaction.executeWithoutResult(status->BusinessLog.run(LOGGER,"报价到期处理",null,()->{
                var initial=requests.find(requestId);if(initial==null)return null;
                policy.lockUsers(initial.getBuyerId(),initial.getInvitedCreatorId());
                reconcile(requests.lock(requestId));return null;
            }));}catch(RuntimeException failure){LOGGER.error("报价到期失败：stage=需求事务, requestId={}",requestId,SafeLog.exception(failure));}
        }}catch(RuntimeException failure){LOGGER.error("报价到期失败：stage=扫描",SafeLog.exception(failure));}
    }
}
