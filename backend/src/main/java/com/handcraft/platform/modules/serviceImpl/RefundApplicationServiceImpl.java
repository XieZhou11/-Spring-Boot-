package com.handcraft.platform.modules.serviceImpl;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
/** 售后按账号→需求→订单→申请→会话→文件锁序，与履约及裁定互斥；新补证仅追加。 */
@Service
public class RefundApplicationServiceImpl implements RefundApplicationService {
    private static final Logger LOGGER=LoggerFactory.getLogger(RefundApplicationServiceImpl.class);
    private final RefundApplicationMapper refunds;private final TradeOrderMapper orders;private final CustomRequestMapper requests;
    private final CustomRequestPolicyService policy;private final OrderImageService images;private final OrderFulfillmentMapper fulfillment;
    private final OrderPaymentMapper payments;private final ConversationMapper chats;private final ConversationService conversations;
    private final NotificationService notifications;private final OperationLogService logs;private final ObjectMapper json;
    public RefundApplicationServiceImpl(RefundApplicationMapper refunds,TradeOrderMapper orders,CustomRequestMapper requests,CustomRequestPolicyService policy,OrderImageService images,OrderFulfillmentMapper fulfillment,OrderPaymentMapper payments,ConversationMapper chats,ConversationService conversations,NotificationService notifications,OperationLogService logs,ObjectMapper json){this.refunds=refunds;this.orders=orders;this.requests=requests;this.policy=policy;this.images=images;this.fulfillment=fulfillment;this.payments=payments;this.chats=chats;this.conversations=conversations;this.notifications=notifications;this.logs=logs;this.json=json;}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Creation create(Long actor,Long orderId,RefundApplicationDTO input){return BusinessLog.run(LOGGER,"普通售后申请",actor,()->{
        var initial=participant(actor,orders.find(orderId));buyer(actor,initial);policy.lockUsers(initial.getBuyerId(),initial.getCreatorId());
        var request=requests.lock(initial.getRequestId());var order=participant(actor,orders.lock(orderId));buyer(actor,order);policy.user(actor);
        var prior=refunds.byCreateKey(actor,input.getRequestKey());
        if(prior!=null){if(!Objects.equals(prior.getOrderId(),orderId)||!Objects.equals(prior.getReasonCode(),input.getReasonCode())||!Objects.equals(prior.getDescription(),input.getDescription())||!ids(prior.getImageIds()).equals(input.getImageIds()))throw conflict("同一请求键不能更改订单或申请内容");return new Creation(prior.getId(),false);}
        var pending=refunds.pending(orderId);
        var settlement=fulfillment.lockSettlement(orderId);var payment=payments.payment(orderId);
        if(settlement==null||payment==null||!"PENDING".equals(settlement.getStatus())||fulfillment.refundFlowForOrder(orderId)!=null)throw conflict("原支付或待结算状态异常，不能受理售后");
        if(payment.getAmount().compareTo(order.getTotalAmount())!=0||payment.getAmount().compareTo(settlement.getPaidAmount())!=0)throw conflict("订单成交、原成功支付与待结算金额不一致");
        var now=policy.now().truncatedTo(ChronoUnit.MILLIS);
        if(request==null||!Objects.equals(request.getBuyerId(),order.getBuyerId()))throw conflict("订单与需求关联异常");
        if(pending!=null||!eligible(order,now))throw conflict("当前订单状态或原七天售后窗口不允许申请");
        if(input.getDescription().strip().length()<20)throw invalid("退款说明至少20字");
        lockConversation(order);images.validate(actor,orderId,"REFUND",input.getImageIds());
        var value=new RefundApplication();value.setOrderId(orderId);value.setBuyerId(actor);value.setApplicationType("NORMAL");value.setOriginalOrderStatus(order.getStatus());value.setReasonCode(input.getReasonCode());value.setDescription(input.getDescription());value.setImageIds(json.writeValueAsString(input.getImageIds()));value.setStatus("WAIT_ADMIN");value.setCreateRequestKey(input.getRequestKey());value.setVersion(0L);value.setCreatedAt(now);refunds.insert(value);
        String before=order.getStatus();order.setStatus("AFTER_SALE");order.setUpdatedAt(now);if(fulfillment.updateOrder(order)!=1)throw conflict("订单状态已变化");
        logs.record(actor,false,"ORDER",orderId,"REFUND_APPLY",before,"AFTER_SALE",null,Map.of("refundId",value.getId().toString(),"requestKey",input.getRequestKey(),"occurredAt",now.toString()));
        notifyBoth(order,"REFUND_APPLIED",value.getId());conversations.orderChanged(order);LOGGER.info("普通售后状态变更已准备：orderId={}, refundId={}, stage=申请与冻结履约",orderId,value.getId());return new Creation(value.getId(),true);
    });}
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public RefundApplicationVO detail(Long actor,Long id){return BusinessLog.run(LOGGER,"售后申请详情查询",actor,()->{var value=required(id);var order=participant(actor,orders.find(value.getOrderId()));policy.user(actor);return view(value,order,actor);});}
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public PageVO<RefundApplicationVO> list(Long actor,Long orderId,int page,int size,String key){return BusinessLog.run(LOGGER,"订单售后申请列表查询",actor,()->{var order=participant(actor,orders.find(orderId));policy.user(actor);int pageSize=Math.min(50,Math.max(1,size));int pageNumber=Math.max(1,page);
        if(key!=null){var value=refunds.byCreateKey(actor,key);var found=value!=null&&Objects.equals(orderId,value.getOrderId())?List.of(view(value,order,actor)):List.<RefundApplicationVO>of();return new PageVO<>(found,found.size(),1,pageSize);}
        return new PageVO<>(refunds.history(orderId,pageSize,(long)(pageNumber-1)*pageSize).stream().map(r->view(r,order,actor)).toList(),refunds.count(orderId),pageNumber,pageSize);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Creation supplement(Long actor,Long id,RefundEvidenceDTO input){return BusinessLog.run(LOGGER,"售后补充证据",actor,()->{
        var initial=required(id);var order=lockOrder(actor,initial);var value=refunds.lock(id);var prior=refunds.evidenceByKey(actor,input.getRequestKey());
        if(prior!=null){if(!Objects.equals(prior.getRefundApplicationId(),id)||!Objects.equals(prior.getContent(),input.getContent())||!ids(prior.getImageIds()).equals(input.getImageIds()))throw conflict("同一请求键不能更改申请或补证内容");return new Creation(id,false);}
        waiting(value,order);if(input.getContent().isBlank()&&input.getImageIds().isEmpty())throw invalid("说明或图片至少填写一项");var now=policy.now().truncatedTo(ChronoUnit.MILLIS);
        lockConversation(order);images.validate(actor,order.getId(),"REFUND",input.getImageIds());var evidence=new RefundEvidence();evidence.setRefundApplicationId(id);evidence.setSubmitterId(actor);evidence.setRequestKey(input.getRequestKey());evidence.setContent(input.getContent());evidence.setImageIds(json.writeValueAsString(input.getImageIds()));evidence.setCreatedAt(now);refunds.insertEvidence(evidence);if(refunds.incrementVersion(id,now)!=1)throw conflict("售后状态已变化");
        logs.record(actor,false,"ORDER",order.getId(),"REFUND_EVIDENCE","AFTER_SALE","AFTER_SALE",null,Map.of("refundId",id.toString(),"evidenceId",evidence.getId().toString(),"requestKey",input.getRequestKey(),"occurredAt",now.toString()));
        notifications.refundChanged(Objects.equals(actor,order.getBuyerId())?order.getCreatorId():order.getBuyerId(),"REFUND_EVIDENCE",evidence.getId(),order.getId(),order.getRequestId());conversations.orderChanged(order);LOGGER.info("售后补证已准备：orderId={}, refundId={}, evidenceId={}, stage=追加及版本递增",order.getId(),id,evidence.getId());return new Creation(id,true);
    });}
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public RefundEvidencePageVO evidence(Long actor,Long id,long after,int size,String key){return BusinessLog.run(LOGGER,"售后补充证据查询",actor,()->{var value=required(id);participant(actor,orders.find(value.getOrderId()));policy.user(actor);int pageSize=Math.min(50,Math.max(1,size));
        if(key!=null){var row=refunds.evidenceByKey(actor,key);var found=row!=null&&Objects.equals(id,row.getRefundApplicationId())?List.of(evidenceView(row)):List.<RefundEvidenceVO>of();return new RefundEvidencePageVO(found,null,false);}
        var rows=refunds.evidence(id,Math.max(0,after),pageSize+1);boolean more=rows.size()>pageSize;var selected=more?rows.subList(0,pageSize):rows;return new RefundEvidencePageVO(selected.stream().map(this::evidenceView).toList(),selected.isEmpty()?null:selected.getLast().getId().toString(),more);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public void withdraw(Long actor,Long id){BusinessLog.run(LOGGER,"买家撤回售后",actor,()->{
        var initial=required(id);var order=lockOrder(actor,initial);buyer(actor,order);var value=refunds.lock(id);if("WITHDRAWN".equals(value.getStatus()))return null;waiting(value,order);
        var now=policy.now().truncatedTo(ChronoUnit.MILLIS);lockConversation(order);value.setStatus("WITHDRAWN");value.setDecisionReason("买家主动撤回普通售后申请");value.setFinishedAt(now);if(refunds.updateTerminal(value)!=1)throw conflict("售后状态已变化");restore(order,value,now);
        logs.record(actor,false,"ORDER",order.getId(),"REFUND_WITHDRAW","AFTER_SALE",order.getStatus(),value.getDecisionReason(),Map.of("refundId",id.toString(),"occurredAt",now.toString()));notifyBoth(order,"REFUND_WITHDRAWN",id);conversations.orderChanged(order);LOGGER.info("售后撤回恢复已准备：orderId={}, refundId={}, restoredStatus={}",order.getId(),id,order.getStatus());return null;
    });}
    @Transactional(propagation=Propagation.MANDATORY)
    public void restore(TradeOrder order,RefundApplication refund,LocalDateTime now){
        if(!"AFTER_SALE".equals(order.getStatus())||!Objects.equals(order.getId(),refund.getOrderId()))throw conflict("订单售后状态或关联异常，无法恢复");
        if(!Set.of("PAID","IN_PRODUCTION","PENDING_SHIP","SHIPPED","COMPLETED").contains(refund.getOriginalOrderStatus()))throw conflict("售后前状态异常");
        if("SHIPPED".equals(refund.getOriginalOrderStatus())){if(order.getAutoConfirmAt()==null||refund.getCreatedAt()==null||now.isBefore(refund.getCreatedAt()))throw conflict("原收货时间或售后时长异常");order.setAutoConfirmAt(order.getAutoConfirmAt().plus(Duration.between(refund.getCreatedAt(),now)));}
        order.setStatus(refund.getOriginalOrderStatus());order.setUpdatedAt(now);if(fulfillment.updateOrder(order)!=1)throw conflict("订单状态恢复失败");
    }
    public boolean eligible(TradeOrder order,LocalDateTime now){return order!=null&&"CUSTOM".equals(order.getOrderType())&&(Set.of("PAID","IN_PRODUCTION","PENDING_SHIP","SHIPPED").contains(order.getStatus())||"COMPLETED".equals(order.getStatus())&&order.getOriginalCompletedAt()!=null&&now.isBefore(order.getOriginalCompletedAt().plusDays(7)));}
    public RefundApplicationVO view(RefundApplication r,TradeOrder o,Long actor){var payment=payments.payment(o.getId());var chat=chats.byRequest(o.getRequestId(),o.getCreatorId());boolean active="NORMAL".equals(r.getApplicationType())&&"WAIT_ADMIN".equals(r.getStatus())&&"AFTER_SALE".equals(o.getStatus());return new RefundApplicationVO(text(r.getId()),text(o.getId()),o.getOrderNo(),text(o.getBuyerId()),text(o.getCreatorId()),r.getApplicationType(),r.getOriginalOrderStatus(),r.getReasonCode(),r.getDescription(),ids(r.getImageIds()),r.getStatus(),r.getCreateRequestKey(),r.getVersion()==null?0:r.getVersion(),time(r.getCreatedAt()),time(r.getFinishedAt()),text(r.getHandlerId()),r.getDecisionReason(),r.getReturnRequired(),r.getReturnTrackingNo(),time(r.getReturnConfirmedAt()),text(r.getReturnConfirmedBy()),r.getNoReturnBasis(),active&&(Objects.equals(actor,o.getBuyerId())||Objects.equals(actor,o.getCreatorId())),active&&Objects.equals(actor,o.getBuyerId()),payment==null?null:payment.getAmount().setScale(2).toPlainString(),chat==null?null:text(chat.getId()));}
    private TradeOrder lockOrder(Long actor,RefundApplication value){var initial=participant(actor,orders.find(value.getOrderId()));policy.lockUsers(initial.getBuyerId(),initial.getCreatorId());var request=requests.lock(initial.getRequestId());var order=participant(actor,orders.lock(initial.getId()));policy.user(actor);if(request==null||!Objects.equals(request.getBuyerId(),order.getBuyerId()))throw conflict("订单与原需求关联不一致");return order;}
    private void lockConversation(TradeOrder order){var first=chats.byRequest(order.getRequestId(),order.getCreatorId());if(first==null)throw conflict("订单关联会话不存在");var chat=chats.lock(first.getId());if(!Objects.equals(chat.getOrderId(),order.getId()))throw conflict("订单会话关联不一致");}
    private void waiting(RefundApplication value,TradeOrder order){if(value==null||!"NORMAL".equals(value.getApplicationType())||!"WAIT_ADMIN".equals(value.getStatus())||!"AFTER_SALE".equals(order.getStatus()))throw conflict("售后申请已结束或订单状态已变化");}
    private RefundApplication required(Long id){var r=refunds.find(id);if(r==null)throw missing();return r;}
    private TradeOrder participant(Long actor,TradeOrder o){if(o==null||!"CUSTOM".equals(o.getOrderType())||!Objects.equals(actor,o.getBuyerId())&&!Objects.equals(actor,o.getCreatorId()))throw missing();return o;}
    private void buyer(Long actor,TradeOrder o){if(!Objects.equals(actor,o.getBuyerId()))throw new BusinessException(CommonErrorCode.FORBIDDEN,"仅订单买家可申请或撤回售后");}
    private void notifyBoth(TradeOrder order,String event,Long id){notifications.refundChanged(order.getBuyerId(),event,id,order.getId(),order.getRequestId());notifications.refundChanged(order.getCreatorId(),event,id,order.getId(),order.getRequestId());}
    private RefundEvidenceVO evidenceView(RefundEvidence e){return new RefundEvidenceVO(text(e.getId()),text(e.getRefundApplicationId()),text(e.getSubmitterId()),e.getContent(),ids(e.getImageIds()),e.getRequestKey(),time(e.getCreatedAt()));}
    private List<String> ids(String raw){return raw==null?List.of():json.readValue(raw,new TypeReference<List<String>>(){});}
    private static String text(Long value){return value==null?null:value.toString();}
    private static OffsetDateTime time(LocalDateTime value){return value==null?null:value.atOffset(ZoneOffset.ofHours(8));}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
    private static BusinessException conflict(String message){return new BusinessException(CommonErrorCode.CONFLICT,message);}
    private static BusinessException invalid(String message){return new BusinessException(CommonErrorCode.INVALID_REQUEST,message);}
}
