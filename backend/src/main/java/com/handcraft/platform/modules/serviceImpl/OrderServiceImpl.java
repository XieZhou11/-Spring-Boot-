package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.*;
import java.time.*;
import java.util.*;
import org.slf4j.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** 定标结果、订单快照、会话及通知共用事务，买家锁防止重复请求与地址修改竞争。 */
@Service
public class OrderServiceImpl implements OrderService {
    private static final Logger LOGGER=LoggerFactory.getLogger(OrderServiceImpl.class);
    private final TradeOrderMapper orders;
    private final QuoteMapper quotes;
    private final CustomRequestMapper requests;
    private final UserAccountMapper users;
    private final ShippingAddressMapper addresses;
    private final CategoryMapper categories;
    private final ConversationMapper conversationMapper;
    private final ConversationService conversations;
    private final CustomRequestPolicyService policy;
    private final QuoteLifecycleService lifecycle;
    private final NotificationService notifications;
    private final OperationLogService logs;
    private final ObjectMapper json;
    private final TransactionTemplate transaction;
    private final OrderPaymentMapper payments;
    private final OrderPaymentService paymentService;
    private final PaymentAccountCryptoService crypto;
    private final OrderFulfillmentMapper fulfillment;

    public OrderServiceImpl(TradeOrderMapper orders,QuoteMapper quotes,CustomRequestMapper requests,UserAccountMapper users,
            ShippingAddressMapper addresses,CategoryMapper categories,ConversationMapper conversationMapper,
            ConversationService conversations,CustomRequestPolicyService policy,QuoteLifecycleService lifecycle,
            NotificationService notifications,OperationLogService logs,ObjectMapper json,PlatformTransactionManager manager,
            OrderPaymentMapper payments,OrderPaymentService paymentService,PaymentAccountCryptoService crypto,OrderFulfillmentMapper fulfillment) {
        this.orders=orders;this.quotes=quotes;this.requests=requests;this.users=users;this.addresses=addresses;this.categories=categories;
        this.conversationMapper=conversationMapper;this.conversations=conversations;this.policy=policy;this.lifecycle=lifecycle;
        this.notifications=notifications;this.logs=logs;this.json=json;
        this.payments=payments;this.paymentService=paymentService;this.crypto=crypto;this.fulfillment=fulfillment;
        transaction=new TransactionTemplate(manager);transaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Creation award(Long userId,Long requestId,AwardDTO input) {
        return BusinessLog.run(LOGGER,"需求定标建单",userId,()->{
            var initial=requests.find(requestId);if(initial==null||!userId.equals(initial.getBuyerId()))throw missing();
            Long quoteId=number(input.getQuoteId());var selected=quotes.find(quoteId);if(selected==null)throw missing();
            BusinessException categoryFailure=null;
            try{policy.lockCategory(initial.getCategoryId());}catch(BusinessException failure){categoryFailure=failure;}
            policy.lockUsers(userId,selected.getCreatorId());var request=requests.lock(requestId);
            var previous=orders.findKey(userId,input.getRequestKey());
            if(previous!=null) {
                if(!same(previous,requestId,input))throw conflict("同一请求键不能更改定标方案、地址或确认日期");
                return new Creation(view(previous,userId,true),false);
            }
            if(categoryFailure!=null)throw categoryFailure;
            policy.user(userId);if(!requestId.equals(selected.getRequestId()))throw missing();
            var history=lifecycle.reconcile(request);policy.open(request);
            selected=history.stream().filter(quote->quoteId.equals(quote.getId())).findFirst().orElseThrow(OrderServiceImpl::missing);
            if(!"ACTIVE".equals(selected.getStatus()))throw conflict("所选报价已失效或定标");
            if(users.findById(userId).isAdminBusinessPaused())throw forbidden("账号新业务已暂停，不能定标建单");
            String reason=policy.creatorReason(users.findById(selected.getCreatorId()),request.getCategoryId());
            if(reason!=null)throw forbidden(reason);
            if(userId.equals(selected.getCreatorId()))throw forbidden("不能向自己定标");
            if("DIRECTED".equals(request.getVisibility())&&!selected.getCreatorId().equals(request.getInvitedCreatorId()))throw missing();
            var estimated=policy.now().toLocalDate().plusDays(selected.getDurationDays());
            if(!estimated.equals(input.getConfirmedEstimatedShipDate()))throw conflict("预计发货日期已变化，请重新确认后定标");
            if(orders.byRequest(requestId)!=null)throw conflict("该需求已经生成订单");
            var address=addresses.lockOwned(userId,number(input.getAddressId()));if(address==null)throw missing();
            var order=new TradeOrder();order.setOrderNo(UUID.randomUUID().toString().replace("-",""));order.setOrderType("CUSTOM");
            order.setBuyerId(userId);order.setCreatorId(selected.getCreatorId());order.setRequestId(requestId);order.setQuoteId(quoteId);
            order.setStatus("PENDING_PAY");order.setTitleSnapshot(request.getTitle());order.setTotalAmount(selected.getGoodsAmount());
            order.setDurationDays(selected.getDurationDays());order.setAgreementSnapshot(json.writeValueAsString(agreement(request,selected,estimated)));
            order.setAddressSnapshot(json.writeValueAsString(addressSnapshot(address)));order.setCreateRequestKey(input.getRequestKey());
            var createdAt=policy.now();order.setCreatedAt(createdAt);order.setUpdatedAt(createdAt);order.setPayDeadlineAt(createdAt.plusHours(24));
            orders.insert(order);
            for(var quote:history)if("ACTIVE".equals(quote.getStatus())) {
                String status=quoteId.equals(quote.getId())?"AWARDED":"LOST";
                quote.setStatus(status);quote.setUpdatedAt(policy.now());
                if(quotes.transition(quote)!=1)throw conflict("报价状态已变化，请刷新后重试");
                logs.record(userId,false,"QUOTE",quote.getId(),status,"ACTIVE",status,null);
                notifications.tradeChanged(quote.getCreatorId(),"QUOTE_"+status,"QUOTE",quote.getId(),requestId);
                notifications.tradeChanged(userId,"QUOTE_"+status,"QUOTE",quote.getId(),requestId);
            }
            lifecycle.state(request,"AWARDED",userId);conversations.linkOrder(request,order);
            logs.record(userId,false,"ORDER",order.getId(),"CREATE",null,"PENDING_PAY",null,Map.of("occurredAt",policy.now().toString()));
            notifications.tradeChanged(userId,"ORDER_CREATED","ORDER",order.getId(),requestId);
            notifications.tradeChanged(order.getCreatorId(),"ORDER_CREATED","ORDER",order.getId(),requestId);
            LOGGER.info("定标及订单快照已准备：requestId={}, quoteId={}, orderId={}",requestId,quoteId,order.getId());
            return new Creation(view(order,userId,true),true);
        });
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public PageVO<OrderVO> list(Long userId,OrderQueryDTO query) {
        return BusinessLog.run(LOGGER,"本人订单列表查询",userId,()->{
            policy.user(userId);var now=policy.now();
            return new PageVO<>(orders.list(userId,query,now,(query.getPage()-1)*query.getSize()).stream()
                    .map(order->view(order,userId,false,now)).toList(),orders.count(userId,query,now),query.getPage(),query.getSize());
        });
    }

    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public OrderVO detail(Long userId,Long orderId) {
        return BusinessLog.run(LOGGER,"订单详情查询",userId,()->{var order=orders.find(orderId);participant(userId,order);policy.user(userId);return view(order,userId,true,policy.now());});
    }

    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public OrderVO cancel(Long userId,Long orderId) {
        return BusinessLog.run(LOGGER,"待付款订单取消",userId,()->{
            var initial=orders.find(orderId);participant(userId,initial);
            if(!userId.equals(initial.getBuyerId()))throw forbidden("仅买家可以取消待付款订单");
            policy.lockUsers(initial.getBuyerId(),initial.getCreatorId());
            var request=requests.lock(initial.getRequestId());var order=orders.lock(orderId);
            if("CANCELLED".equals(order.getStatus()))return view(order,userId,true);
            if(!"PENDING_PAY".equals(order.getStatus()))throw conflict("仅待付款订单可以取消");
            cancelLocked(request,order,userId,overdue(order)?"TIMEOUT":"BUYER_CANCELLED");return view(order,userId,true);
        });
    }

    private void cancelLocked(CustomRequest request,TradeOrder order,Long actorId,String reason) {
        var occurredAt="TIMEOUT".equals(reason)?order.getPayDeadlineAt():policy.now();
        if(orders.cancel(order.getId(),policy.now())!=1)throw conflict("订单状态已变化");
        order.setStatus("CANCELLED");order.setUpdatedAt(policy.now());
        lifecycle.state(request,"CLOSED",actorId);
        logs.record(actorId,false,"ORDER",order.getId(),"CANCEL","PENDING_PAY","CANCELLED",reason,Map.of("occurredAt",occurredAt.toString()));
        notifications.tradeChanged(order.getBuyerId(),"ORDER_CANCELLED","ORDER",order.getId(),order.getRequestId());
        notifications.tradeChanged(order.getCreatorId(),"ORDER_CANCELLED","ORDER",order.getId(),order.getRequestId());
        LOGGER.info("订单取消及需求关闭已准备：orderId={}, requestId={}, reason={}",order.getId(),request.getId(),reason);
    }

    /** 到期处理沿用用户→需求→订单锁序，保留中标会话和报价历史。 */
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    public void expireDue() {
        try {for(var orderId:orders.due(policy.now())) {
            try {transaction.executeWithoutResult(status->BusinessLog.run(LOGGER,"待付款订单超时取消",null,()->{
                var initial=orders.find(orderId);if(initial==null)return null;
                policy.lockUsers(initial.getBuyerId(),initial.getCreatorId());
                var request=requests.lock(initial.getRequestId());var order=orders.lock(orderId);
                if(overdue(order))cancelLocked(request,order,null,"TIMEOUT");return null;
            }));}catch(RuntimeException failure){LOGGER.error("订单超时取消失败：stage=单笔事务, orderId={}",orderId,SafeLog.exception(failure));}
        }}catch(RuntimeException failure){LOGGER.error("订单超时取消失败：stage=扫描",SafeLog.exception(failure));}
    }

    private OrderVO view(TradeOrder order,Long userId,boolean detailed) {
        return view(order,userId,detailed,policy.now());
    }

    /** 一个只读聚合复用同一数据库快照和服务器时刻，避免并发支付造成字段撕裂。 */
    private OrderVO view(TradeOrder order,Long userId,boolean detailed,LocalDateTime now) {
        boolean owned=userId.equals(order.getBuyerId()),overdue=overdue(order,now);
        String status=overdue?"CANCELLED":order.getStatus();
        var buyer=users.findById(order.getBuyerId());var creator=users.findById(order.getCreatorId());
        var conversation=conversationMapper.byRequest(order.getRequestId(),order.getCreatorId());
        var operations=orders.history(order.getId());
        var history=operations.stream().map(operation->new OrderHistoryVO(operation.getAction(),operation.getBeforeStatus(),operation.getAfterStatus(),operation.getReason(),time(operationTime(operation)))).toList();
        var cancellation=operations.stream().filter(operation->"CANCELLED".equals(operation.getAfterStatus())).findFirst().orElse(null);
        var cancelledAt=cancellation==null?(overdue?order.getPayDeadlineAt():null):operationTime(cancellation);
        String reason=cancellation==null?(overdue?"TIMEOUT":null):cancellation.getReason();
        var payment=payments.payment(order.getId());
        var paidAmount=payment==null?null:payment.getAmount().setScale(2).toPlainString();
        var payOperation=operations.stream().filter(operation->"PAY".equals(operation.getAction())).findFirst().orElse(null);
        var terms=payOperation==null||payOperation.getDetail()==null?null:json.readTree(payOperation.getDetail());
        var paymentView=!detailed||payment==null?null:new OrderPaymentVO(payment.getFlowNo(),paidAmount,payment.getResult(),time(payment.getOccurredAt()),
                terms==null?null:terms.path("termsVersion").asText(null),terms==null?null:terms.path("termsText").asText(null));
        var settlement=detailed&&!owned?payments.settlement(order.getId()):null;
        var settlementView=settlement==null?null:new OrderSettlementVO(settlement.getPaidAmount().setScale(2).toPlainString(),settlement.getStatus(),maskedPayee(order,settlement));
        boolean pending=fulfillment.hasPending(order.getId());
        boolean active=!pending&&!Set.of("AFTER_SALE","CANCELLED","REFUNDED","COMPLETED").contains(status);
        var nodes=detailed?payments.nodes(order.getId()).stream().map(node->{
            boolean handled=Set.of("CHECKED","SKIPPED").contains(node.getStatus());
            boolean unlocked=active&&!owned&&"UNLOCKED".equals(node.getStatus())&&"IN_PRODUCTION".equals(status);
            var records=fulfillment.records(node.getId()).stream().map(r->new OrderProgressRecordVO(r.getId().toString(),r.getRequestKey(),r.getRecordType(),r.getContent(),ids(r.getImageIds()),r.getSkipReason(),time(r.getCreatedAt()))).toList();
            var actual=node.getHandledAt()==null?now.toLocalDate():node.getHandledAt().toLocalDate();
            long deviation=java.time.temporal.ChronoUnit.DAYS.between(node.getPlannedFinishDate(),actual);
            return new OrderProgressNodeVO(node.getId().toString(),node.getNodeCode(),node.getSortOrder(),node.getPlannedFinishDate(),node.getStatus(),time(node.getHandledAt()),records,
                    unlocked&&node.getSortOrder()<5,unlocked&&"SAMPLE".equals(node.getNodeCode()),active&&!owned&&handled&&Set.of("IN_PRODUCTION","PENDING_SHIP","SHIPPED").contains(status),deviation,!handled&&deviation>0);
        }).toList():List.<OrderProgressNodeVO>of();
        var trackingHistory=detailed?fulfillment.corrections(order.getId()).stream().map(op->{var detail=json.readTree(op.getDetail());return new OrderTrackingHistoryVO(op.getId().toString(),detail.path("requestKey").asText(),detail.path("oldTrackingNo").asText(),detail.path("newTrackingNo").asText(),text(op.getOperatorId()),time(operationTime(op)));}).toList():List.<OrderTrackingHistoryVO>of();
        var refund=detailed?fulfillment.refunded(order.getId()):null;var refundedFlow=refund==null?null:fulfillment.refundFlowForOrder(order.getId());
        var refundView=refund==null?null:new OrderNoStartRefundVO(refund.getId().toString(),refund.getDescription(),ids(refund.getImageIds()),refundedFlow==null?null:refundedFlow.getAmount().setScale(2).toPlainString(),refundedFlow==null?null:refundedFlow.getFlowNo(),time(refund.getFinishedAt()),refund.getDecisionReason());
        boolean canPay=owned&&"PENDING_PAY".equals(status)&&!buyer.isAdmin();
        var preview=detailed&&canPay?paymentService.preview(now.toLocalDate(),order.getDurationDays()):null;
        return new OrderVO(order.getId().toString(),order.getOrderNo(),order.getOrderType(),order.getBuyerId().toString(),buyer.getNickname(),
                order.getCreatorId().toString(),creator.getNickname(),text(order.getRequestId()),text(order.getQuoteId()),status,
                order.getTitleSnapshot(),order.getTotalAmount().setScale(2).toPlainString(),order.getDurationDays(),map(order.getAgreementSnapshot()),
                detailed&&(owned||"PENDING_SHIP".equals(status)||order.getShippedAt()!=null)?map(order.getAddressSnapshot()):null,time(order.getCreatedAt()),time(order.getPayDeadlineAt()),time(cancelledAt),reason,
                owned,owned&&"PENDING_PAY".equals(status),conversation==null?null:conversation.getId().toString(),history,
                canPay,paidAmount,time(order.getPaidAt()),time(order.getTermsConfirmedAt()),order.getShipDeadlineAt()==null?null:order.getShipDeadlineAt().toLocalDate().minusDays(1),
                time(order.getShipDeadlineAt()),preview,paymentView,settlementView,nodes,time(order.getStartedAt()),time(order.getPaidAt()==null?null:order.getPaidAt().plusHours(48)),order.getTrackingNo(),time(order.getShippedAt()),time(order.getAutoConfirmAt()),time(order.getOriginalCompletedAt()),time(now),
                active&&!owned&&"PAID".equals(status),active&&!owned&&"PENDING_SHIP".equals(status),active&&!owned&&"SHIPPED".equals(status),active&&owned&&"SHIPPED".equals(status),
                active&&owned&&"PAID".equals(status)&&order.getStartedAt()==null&&order.getPaidAt()!=null&&!now.isBefore(order.getPaidAt().plusHours(48)),
                Set.of("PAID","IN_PRODUCTION","PENDING_SHIP").contains(status)&&order.getShippedAt()==null&&order.getShipDeadlineAt()!=null&&!now.isBefore(order.getShipDeadlineAt()),trackingHistory,refundView);
    }

    /** 只从本单原快照解密后生成脱敏文本，不返回申请编号、姓名原文或编码密文。 */
    private String maskedPayee(TradeOrder order,OrderSettlement settlement){
        var snapshot=json.readTree(settlement.getPayeeSnapshot());
        String name=snapshot.path("real_name").asText();
        String account=crypto.decrypt(order.getCreatorId(),Base64.getDecoder().decode(snapshot.path("alipay_account_ciphertext").asText()));
        return (name.isEmpty()?"**":name.substring(0,1)+"**")+" / "+(account.length()<5?"****":account.substring(0,1)+"****"+account.substring(account.length()-2));
    }

    private LocalDateTime operationTime(WorkOperation operation) {
        if(operation.getDetail()!=null) {
            var recorded=json.readTree(operation.getDetail()).path("occurredAt").asText(null);
            if(recorded!=null)return LocalDateTime.parse(recorded);
        }
        return operation.getCreatedAt();
    }
    private Map<String,Object> agreement(CustomRequest request,Quote quote,LocalDate estimated) {
        var content=new LinkedHashMap<String,Object>();content.put("title",request.getTitle());content.put("description",request.getDescription());
        content.put("purpose",request.getPurpose());content.put("materialPreference",request.getMaterialPreference());content.put("specification",request.getSpecification());
        var path=new ArrayList<String>();var category=categories.find(request.getCategoryId());
        if(category.getParentId()!=null)path.add(categories.find(category.getParentId()).getName());path.add(category.getName());
        content.put("categoryPath",path);content.put("referenceImageIds",ids(request.getReferenceImageIds()));content.put("sourceWorkId",text(request.getSourceWorkId()));
        var snapshot=new LinkedHashMap<String,Object>();snapshot.put("request",content);snapshot.put("proposal",quote.getProposal());
        snapshot.put("additionalAgreement",quote.getAdditionalAgreement());snapshot.put("imageIds",ids(quote.getImageIds()));
        snapshot.put("expectedShipDate",request.getExpectedShipDate());snapshot.put("confirmedEstimatedShipDate",estimated);
        snapshot.put("durationDays",quote.getDurationDays());snapshot.put("goodsAmount",quote.getGoodsAmount().setScale(2).toPlainString());return snapshot;
    }
    private Map<String,Object> addressSnapshot(ShippingAddress address) {
        return Map.of("id",address.getId().toString(),"recipientName",address.getRecipientName(),"phone",address.getPhone(),"province",address.getProvince(),
                "city",address.getCity(),"district",address.getDistrict(),"detailAddress",address.getDetailAddress());
    }
    private boolean same(TradeOrder order,Long requestId,AwardDTO input) {
        return requestId.equals(order.getRequestId())&&number(input.getQuoteId()).equals(order.getQuoteId())
                &&input.getAddressId().equals(map(order.getAddressSnapshot()).get("id"))
                &&input.getConfirmedEstimatedShipDate().toString().equals(map(order.getAgreementSnapshot()).get("confirmedEstimatedShipDate"));
    }
    private boolean overdue(TradeOrder order){return overdue(order,policy.now());}
    private boolean overdue(TradeOrder order,LocalDateTime now){return "PENDING_PAY".equals(order.getStatus())&&!now.isBefore(order.getPayDeadlineAt());}
    /** 当前订单入口仅承接定制流程，现货交易由后续独立任务开放。 */
    private void participant(Long userId,TradeOrder order){if(order==null||!"CUSTOM".equals(order.getOrderType())||!userId.equals(order.getBuyerId())&&!userId.equals(order.getCreatorId()))throw missing();}
    private Map<String,Object> map(String raw){return json.readValue(raw,new TypeReference<Map<String,Object>>(){});}
    private List<String> ids(String raw){return json.readValue(raw,new TypeReference<List<String>>(){});}
    private static Long number(String value){try{return Long.valueOf(value);}catch(NumberFormatException failure){throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"资源编号无效");}}
    private static String text(Long value){return value==null?null:value.toString();}
    private static OffsetDateTime time(LocalDateTime value){return value==null?null:value.atOffset(ZoneOffset.ofHours(8));}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
    private static BusinessException forbidden(String reason){return new BusinessException(CommonErrorCode.FORBIDDEN,reason);}
    private static BusinessException conflict(String reason){return new BusinessException(CommonErrorCode.CONFLICT,reason);}
}
