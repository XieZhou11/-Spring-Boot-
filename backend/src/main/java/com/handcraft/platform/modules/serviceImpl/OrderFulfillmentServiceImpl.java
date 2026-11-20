package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.dto.*;
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
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** 履约统一持双方账号→需求→订单→退款→结算→节点→会话→文件锁，不重新检查接新单资格。 */
@Service
public class OrderFulfillmentServiceImpl implements OrderFulfillmentService {
    private static final Logger LOGGER=LoggerFactory.getLogger(OrderFulfillmentServiceImpl.class);
    private static final Set<String> FULFILLING=Set.of("IN_PRODUCTION","PENDING_SHIP","SHIPPED");
    private final TradeOrderMapper orders;
    private final OrderFulfillmentMapper fulfillment;
    private final OrderPaymentMapper payments;
    private final CustomRequestMapper requests;
    private final CustomRequestPolicyService policy;
    private final ConversationMapper conversationMapper;
    private final ConversationService conversations;
    private final OrderImageService images;
    private final QuoteLifecycleService lifecycle;
    private final NotificationService notifications;
    private final OperationLogService logs;
    private final ObjectMapper json;
    private final TransactionTemplate transaction;
    public OrderFulfillmentServiceImpl(TradeOrderMapper orders,OrderFulfillmentMapper fulfillment,OrderPaymentMapper payments,
            CustomRequestMapper requests,CustomRequestPolicyService policy,ConversationMapper conversationMapper,
            ConversationService conversations,OrderImageService images,QuoteLifecycleService lifecycle,
            NotificationService notifications,OperationLogService logs,ObjectMapper json,PlatformTransactionManager manager){
        this.orders=orders;this.fulfillment=fulfillment;this.payments=payments;this.requests=requests;this.policy=policy;
        this.conversationMapper=conversationMapper;this.conversations=conversations;this.images=images;this.lifecycle=lifecycle;
        this.notifications=notifications;this.logs=logs;this.json=json;transaction=new TransactionTemplate(manager);
        transaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }
    private record Locked(TradeOrder order,CustomRequest request,LocalDateTime now,boolean pending){}
    /** 全部等待结束后一次取毫秒北京时刻，资格暂停只限制新单，不能阻断旧单履约。 */
    private Locked lock(Long actor,Long orderId,boolean buyer){
        var initial=orders.find(orderId);participant(actor,initial);
        if(!(buyer?initial.getBuyerId():initial.getCreatorId()).equals(actor))throw forbidden(buyer?"仅买家可以操作":"仅本单创作者可以操作");
        policy.lockUsers(initial.getBuyerId(),initial.getCreatorId());
        var request="CUSTOM".equals(initial.getOrderType())?requests.lock(initial.getRequestId()):null;var order=orders.lock(orderId);participant(actor,order);policy.user(actor);
        if("CUSTOM".equals(order.getOrderType())&&(request==null||!Objects.equals(request.getBuyerId(),order.getBuyerId())))throw conflict("订单与原需求关联不一致");
        boolean pending=fulfillment.pending(orderId)!=null;
        return new Locked(order,request,policy.now().truncatedTo(ChronoUnit.MILLIS),pending);
    }
    private void active(Locked c){
        if(c.pending()||"AFTER_SALE".equals(c.order().getStatus()))throw conflict("售后处理中，履约操作已暂停");
        if("STOCK".equals(c.order().getOrderType()))return;
        if(!"IN_TRADE".equals(c.request().getStatus()))throw conflict("需求当前状态不允许继续履约");
    }
    private List<OrderProgressNode> nodesAndConversation(TradeOrder order){
        var nodes=fulfillment.lockNodes(order.getId());if(nodes.size()!=5)throw conflict("订单制作计划不完整");
        var conversation=conversationMapper.byRequest(order.getRequestId(),order.getCreatorId());
        if(conversation==null)throw conflict("订单关联会话不存在");
        var locked=conversationMapper.lock(conversation.getId());
        if(!Objects.equals(order.getId(),locked.getOrderId())||!Objects.equals(order.getBuyerId(),locked.getBuyerId()))throw conflict("订单会话关联不一致");
        return nodes;
    }
    /** 现货没有制作节点，发货只锁定订单专属会话并保存运单时间线。 */
    private void stockConversation(TradeOrder order){var first=conversationMapper.byOrder(order.getId());if(first==null)throw conflict("现货订单会话不存在");var locked=conversationMapper.lock(first.getId());if(!Objects.equals(order.getId(),locked.getOrderId())||!Objects.equals(order.getBuyerId(),locked.getBuyerId())||!Objects.equals(order.getCreatorId(),locked.getCreatorId()))throw conflict("现货订单会话关联不一致");}
    private <T>T run(String name,Long actor,Long orderId,Supplier<T> work){
        return BusinessLog.run(LOGGER,name,actor,()->{try{return work.get();}
            catch(BusinessException e){LOGGER.warn("{}拒绝：stage=锁后业务校验, orderId={}, userId={}, reason={}",name,orderId,actor,e.getMessage());throw e;}
            catch(RuntimeException e){LOGGER.error("{}异常：stage=原子持久化, orderId={}, userId={}",name,orderId,actor,SafeLog.exception(e));throw e;}});
    }
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public boolean start(Long actor,Long orderId){return run("定制确认开工",actor,orderId,()->{
        var c=lock(actor,orderId,false);var order=c.order();if(order.getStartedAt()!=null)return false;active(c);
        if(!"PAID".equals(order.getStatus())||order.getPaidAt()==null)throw conflict("仅已付款待开工订单可以确认开工");
        var nodes=nodesAndConversation(order);if(nodes.stream().anyMatch(n->!"NOT_STARTED".equals(n.getStatus())))throw conflict("初始节点状态异常");
        order.setStartedAt(c.now());order.setStatus("IN_PRODUCTION");save(c);
        fulfillment.nodeState(nodes.getFirst().getId(),"UNLOCKED",null,c.now());
        history(actor,c,"START","PAID","IN_PRODUCTION",Map.of());both(c,"ORDER_STARTED",orderId);conversations.orderChanged(order);return true;
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public boolean checkIn(Long actor,Long orderId,Long nodeId,OrderCheckInDTO input){return run("制作节点打卡",actor,orderId,()->{
        var c=lock(actor,orderId,false);ownedNode(orderId,nodeId);
        if(retry(actor,nodeId,input.getRequestKey(),"CHECKIN",input.getContent(),input.getImageIds(),null))return false;
        active(c);if(!"IN_PRODUCTION".equals(c.order().getStatus()))throw conflict("订单当前不可制作打卡");
        var nodes=nodesAndConversation(c.order());var node=node(nodes,nodeId);if(node.getSortOrder()==5)throw conflict("包装发货节点须随运单号同时提交");
        ready(nodes,node);requireContent(input.getContent(),5);unique(input.getImageIds());images.validate(actor,orderId,"PROGRESS",input.getImageIds());
        var record=record(actor,nodeId,input.getRequestKey(),"CHECKIN",input.getContent(),input.getImageIds(),null,c.now());
        String before=c.order().getStatus();handled(c,nodes,node,"CHECKED");history(actor,c,"PROGRESS_CHECKIN",before,c.order().getStatus(),Map.of("recordId",record.getId().toString()));
        notifications.fulfillmentChanged(c.order().getBuyerId(),"ORDER_PROGRESS",record.getId(),orderId,c.order().getRequestId());conversations.orderChanged(c.order());return true;
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public boolean skip(Long actor,Long orderId,Long nodeId,OrderSkipDTO input){return run("制作打样跳过",actor,orderId,()->{
        var c=lock(actor,orderId,false);ownedNode(orderId,nodeId);if(retry(actor,nodeId,input.getRequestKey(),"SKIP",input.getContent(),List.of(),input.getSkipReason()))return false;
        active(c);if(!"IN_PRODUCTION".equals(c.order().getStatus()))throw conflict("订单当前不可处理制作节点");
        var nodes=nodesAndConversation(c.order());var node=node(nodes,nodeId);if(!"SAMPLE".equals(node.getNodeCode()))throw conflict("仅打样打版节点可以说明原因跳过");
        ready(nodes,node);requireContent(input.getContent(),10);
        var record=record(actor,nodeId,input.getRequestKey(),"SKIP",input.getContent(),List.of(),input.getSkipReason(),c.now());handled(c,nodes,node,"SKIPPED");
        history(actor,c,"PROGRESS_SKIP","IN_PRODUCTION","IN_PRODUCTION",Map.of("recordId",record.getId().toString()));
        notifications.fulfillmentChanged(c.order().getBuyerId(),"ORDER_PROGRESS",record.getId(),orderId,c.order().getRequestId());conversations.orderChanged(c.order());return true;
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public boolean supplement(Long actor,Long orderId,Long nodeId,OrderSupplementDTO input){return run("制作进度补充",actor,orderId,()->{
        var c=lock(actor,orderId,false);ownedNode(orderId,nodeId);String content=input.getContent()==null?"":input.getContent();
        if(retry(actor,nodeId,input.getRequestKey(),"SUPPLEMENT",content,input.getImageIds(),null))return false;
        active(c);if(!FULFILLING.contains(c.order().getStatus()))throw conflict("仅履约中可追加制作图文，订单结束后请在会话补证");
        var nodes=nodesAndConversation(c.order());var node=node(nodes,nodeId);
        if(!Set.of("CHECKED","SKIPPED").contains(node.getStatus()))throw conflict("仅已处理节点可追加补充");
        if(content.isBlank()&&input.getImageIds().isEmpty())throw invalid("补充文字和图片至少填写一项");
        unique(input.getImageIds());images.validate(actor,orderId,"PROGRESS",input.getImageIds());
        var record=record(actor,nodeId,input.getRequestKey(),"SUPPLEMENT",content,input.getImageIds(),null,c.now());
        history(actor,c,"PROGRESS_SUPPLEMENT",c.order().getStatus(),c.order().getStatus(),Map.of("recordId",record.getId().toString()));
        notifications.fulfillmentChanged(c.order().getBuyerId(),"ORDER_PROGRESS",record.getId(),orderId,c.order().getRequestId());conversations.orderChanged(c.order());return true;
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public boolean ship(Long actor,Long orderId,OrderShipmentDTO input){return run("定制包装发货",actor,orderId,()->{
        var c=lock(actor,orderId,false);var prior=fulfillment.recordByKey(actor,input.getRequestKey());
        if("STOCK".equals(c.order().getOrderType())){
            var old=fulfillment.operation(orderId,"SHIP");
            if(old!=null){var detail=json.readTree(old.getDetail());if(input.getRequestKey().equals(detail.path("requestKey").asText())&&input.getTrackingNo().equals(detail.path("trackingNo").asText()))return false;}
            active(c);if(!"PENDING_SHIP".equals(c.order().getStatus()))throw conflict("仅待发货现货订单可确认发货");
            if(!input.getTrackingNo().matches("[A-Za-z0-9]{8,30}"))throw invalid("运单号须为8至30位字母数字");
            stockConversation(c.order());var order=c.order();order.setTrackingNo(input.getTrackingNo());order.setShippedAt(c.now());order.setAutoConfirmAt(c.now().plusDays(7));order.setStatus("SHIPPED");save(c);
            history(actor,c,"SHIP","PENDING_SHIP","SHIPPED",Map.of("requestKey",input.getRequestKey(),"trackingNo",input.getTrackingNo()));
            both(c,"ORDER_SHIPPED",orderId);conversations.orderChanged(order);return true;
        }
        if(prior!=null){
            var original=fulfillment.operation(orderId,"SHIP");
            if(original==null||!json.readTree(original.getDetail()).path("trackingNo").asText().equals(input.getTrackingNo()))throw conflict("同一发货请求不能更改原始运单号");
            var fifth=payments.nodes(orderId).stream().filter(n->n.getSortOrder()==5).findFirst().orElseThrow(()->conflict("包装节点不存在"));
            if(retry(actor,fifth.getId(),input.getRequestKey(),"CHECKIN",input.getContent(),input.getImageIds(),null))return false;
        }
        active(c);if(!"PENDING_SHIP".equals(c.order().getStatus()))throw conflict("仅前四节点完成后的订单可发货");
        var nodes=nodesAndConversation(c.order());var fifth=nodes.getLast();ready(nodes,fifth);requireContent(input.getContent(),5);
        unique(input.getImageIds());images.validate(actor,orderId,"PROGRESS",input.getImageIds());
        var record=record(actor,fifth.getId(),input.getRequestKey(),"CHECKIN",input.getContent(),input.getImageIds(),null,c.now());
        fulfillment.nodeState(fifth.getId(),"CHECKED",c.now(),c.now());
        var order=c.order();order.setTrackingNo(input.getTrackingNo());order.setShippedAt(c.now());order.setAutoConfirmAt(c.now().plusDays(7));order.setStatus("SHIPPED");save(c);
        history(actor,c,"SHIP","PENDING_SHIP","SHIPPED",Map.of("requestKey",input.getRequestKey(),"trackingNo",input.getTrackingNo(),"recordId",record.getId().toString()));
        both(c,"ORDER_SHIPPED",orderId);conversations.orderChanged(order);return true;
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public void correctTracking(Long actor,Long orderId,OrderTrackingDTO input){run("发货运单更正",actor,orderId,()->{
        var c=lock(actor,orderId,false);var prior=fulfillment.correctionByKey(actor,input.getRequestKey());
        if(prior!=null){var detail=json.readTree(prior.getDetail());
            if(!detail.path("orderId").asText().equals(orderId.toString())||!detail.path("oldTrackingNo").asText().equals(input.getExpectedTrackingNo())||!detail.path("newTrackingNo").asText().equals(input.getTrackingNo()))throw conflict("同一更正请求键不能修改订单或运单参数");return null;}
        active(c);var order=c.order();if(!"SHIPPED".equals(order.getStatus()))throw conflict("仅确认收货前可以更正运单号");
        if(!Objects.equals(order.getTrackingNo(),input.getExpectedTrackingNo()))throw conflict("运单号已被更正，请刷新后确认");
        if(input.getTrackingNo().equals(input.getExpectedTrackingNo()))throw invalid("更正后的运单号须不同于原值");
        if("STOCK".equals(order.getOrderType()))stockConversation(order);else nodesAndConversation(order);order.setTrackingNo(input.getTrackingNo());save(c);
        history(actor,c,"TRACKING_CORRECT","SHIPPED","SHIPPED",Map.of("orderId",orderId.toString(),"requestKey",input.getRequestKey(),"oldTrackingNo",input.getExpectedTrackingNo(),"newTrackingNo",input.getTrackingNo()));
        var operation=fulfillment.correctionByKey(actor,input.getRequestKey());
        notifications.fulfillmentChanged(order.getBuyerId(),"ORDER_TRACKING_CORRECTED",operation.getId(),orderId,order.getRequestId());conversations.orderChanged(order);return null;
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public boolean receive(Long actor,Long orderId){return run("订单确认收货",actor,orderId,()->{
        var c=lock(actor,orderId,true);if(c.order().getOriginalCompletedAt()!=null)return false;active(c);
        if(!"SHIPPED".equals(c.order().getStatus()))throw conflict("仅已发货订单可以确认收货");if("STOCK".equals(c.order().getOrderType()))stockConversation(c.order());else nodesAndConversation(c.order());complete(c,actor,false);return true;
    });}
    /** 每单独立事务且用键集遍历；旧的失败订单不会阻塞高编号订单的提醒和自动收货。 */
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    public void scanDue(){
        try{long after=0;while(true){var batch=fulfillment.scanAfter(after,policy.now());if(batch.isEmpty())break;
            for(Long id:batch){after=id;try{transaction.executeWithoutResult(status->run("订单履约定时处理",null,id,()->{scanLocked(id);return null;}));}
                catch(RuntimeException failure){LOGGER.error("订单履约扫描失败：stage=单笔事务, orderId={}",id,SafeLog.exception(failure));}}
        }}catch(RuntimeException failure){LOGGER.error("订单履约扫描失败：stage=键集扫描",SafeLog.exception(failure));}
    }
    private void scanLocked(Long id){
        var initial=orders.find(id);if(initial==null)return;var c=lock(initial.getBuyerId(),id,true);var order=c.order();
        if(c.pending()||"AFTER_SALE".equals(order.getStatus()))return;
        if("SHIPPED".equals(order.getStatus())&&order.getAutoConfirmAt()!=null&&!c.now().isBefore(order.getAutoConfirmAt())){if("STOCK".equals(order.getOrderType()))stockConversation(order);else nodesAndConversation(order);complete(c,null,true);}
        if(Set.of("PAID","IN_PRODUCTION","PENDING_SHIP").contains(order.getStatus())&&order.getShippedAt()==null&&order.getShipDeadlineAt()!=null&&!c.now().isBefore(order.getShipDeadlineAt()))both(c,"ORDER_SHIPPING_OVERDUE",id);
        if("CUSTOM".equals(order.getOrderType())&&"COMPLETED".equals(order.getStatus())&&order.getOriginalCompletedAt()!=null&&!c.now().isBefore(order.getOriginalCompletedAt().plusDays(7))&&"IN_TRADE".equals(c.request().getStatus()))lifecycle.state(c.request(),"COMPLETED",null);
    }
    private void complete(Locked c,Long actor,boolean automatic){
        var order=c.order();order.setStatus("COMPLETED");if(order.getOriginalCompletedAt()==null)order.setOriginalCompletedAt(c.now());save(c);
        history(actor,c,automatic?"AUTO_RECEIVE":"RECEIVE","SHIPPED","COMPLETED",Map.of());both(c,"ORDER_RECEIVED",order.getId());conversations.orderChanged(order);
    }
    private void save(Locked c){c.order().setUpdatedAt(c.now());if(fulfillment.updateOrder(c.order())!=1)throw conflict("订单状态已变化");}
    private void handled(Locked c,List<OrderProgressNode> nodes,OrderProgressNode node,String state){
        fulfillment.nodeState(node.getId(),state,c.now(),c.now());
        if(node.getSortOrder()<5)fulfillment.nodeState(nodes.get(node.getSortOrder()).getId(),"UNLOCKED",null,c.now());
        if(node.getSortOrder()==4){c.order().setStatus("PENDING_SHIP");save(c);}
    }
    private void ready(List<OrderProgressNode> nodes,OrderProgressNode node){
        if(!"UNLOCKED".equals(node.getStatus())||nodes.stream().anyMatch(n->n.getSortOrder()<node.getSortOrder()&&!Set.of("CHECKED","SKIPPED").contains(n.getStatus())))throw conflict("请按顺序处理已解锁节点");
    }
    private OrderProgressNode node(List<OrderProgressNode> nodes,Long nodeId){return nodes.stream().filter(n->n.getId().equals(nodeId)).findFirst().orElseThrow(()->new BusinessException(CommonErrorCode.NOT_FOUND));}
    /** 幂等重放前也须绑定路径订单，不能借另一个订单的原记录伪成功。 */
    private void ownedNode(Long orderId,Long nodeId){if(payments.nodes(orderId).stream().noneMatch(n->n.getId().equals(nodeId)))throw new BusinessException(CommonErrorCode.NOT_FOUND);}
    private OrderProgressRecord record(Long actor,Long nodeId,String key,String type,String content,List<String> imageIds,String skipReason,LocalDateTime now){
        var r=new OrderProgressRecord();r.setCreatorId(actor);r.setNodeId(nodeId);r.setRequestKey(key);r.setRecordType(type);r.setContent(content);r.setImageIds(json.writeValueAsString(imageIds));r.setSkipReason(skipReason);r.setCreatedAt(now);fulfillment.insertRecord(r);return r;
    }
    private boolean retry(Long actor,Long nodeId,String key,String type,String content,List<String> imageIds,String reason){
        var prior=fulfillment.recordByKey(actor,key);if(prior==null)return false;
        if(!prior.getNodeId().equals(nodeId)||!prior.getRecordType().equals(type)||!Objects.equals(prior.getContent(),content)||!ids(prior.getImageIds()).equals(imageIds)||!Objects.equals(prior.getSkipReason(),reason))throw conflict("同一图文请求键不能更改节点、操作类型或原始输入");return true;
    }
    private void history(Long actor,Locked c,String action,String before,String after,Map<String,Object> detail){var values=new LinkedHashMap<>(detail);values.put("occurredAt",c.now().toString());logs.record(actor,false,"ORDER",c.order().getId(),action,before,after,null,values);}
    private void both(Locked c,String event,Long eventId){var order=c.order();notifications.fulfillmentChanged(order.getBuyerId(),event,eventId,order.getId(),order.getRequestId());notifications.fulfillmentChanged(order.getCreatorId(),event,eventId,order.getId(),order.getRequestId());}
    private List<String> ids(String raw){return json.readValue(raw,new TypeReference<List<String>>(){});}
    private void requireContent(String content,int minimum){if(content==null||content.strip().length()<minimum||content.length()>500)throw invalid("说明字数不符合要求");}
    private void unique(List<String> imageIds){if(new HashSet<>(imageIds).size()!=imageIds.size())throw invalid("同一提交不能重复引用图片");}
    private void participant(Long actor,TradeOrder order){if(order==null||!Set.of("CUSTOM","STOCK").contains(order.getOrderType())||!Objects.equals(actor,order.getBuyerId())&&!Objects.equals(actor,order.getCreatorId()))throw new BusinessException(CommonErrorCode.NOT_FOUND);}
    private static BusinessException conflict(String text){return new BusinessException(CommonErrorCode.CONFLICT,text);}
    private static BusinessException invalid(String text){return new BusinessException(CommonErrorCode.INVALID_REQUEST,text);}
    private static BusinessException forbidden(String text){return new BusinessException(CommonErrorCode.FORBIDDEN,text);}
}
