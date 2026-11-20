package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.*;
import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** 管理员只读查证与交易参与方资格分离；裁定按统一锁序与资金处置同事务提交。 */
@Service
public class AdminRefundServiceImpl implements AdminRefundService {
    private static final Logger LOGGER=LoggerFactory.getLogger(AdminRefundServiceImpl.class);
    private final AdminRefundMapper adminData;
    private final RefundApplicationMapper refunds;
    private final UserAccountMapper users;
    private final TradeOrderMapper orders;
    private final CustomRequestMapper requests;
    private final OrderPaymentMapper payments;
    private final OrderFulfillmentMapper fulfillment;
    private final ConversationMapper conversations;
    private final FileAssetMapper files;
    private final CustomRequestPolicyService policy;
    private final RefundApplicationService applications;
    private final OrderRefundExecutionService execution;
    private final OperationLogService logs;
    private final NotificationService notifications;
    private final ConversationService events;
    private final PrivateImageStorage storage;
    private final ObjectMapper json;

    public AdminRefundServiceImpl(AdminRefundMapper adminData,RefundApplicationMapper refunds,UserAccountMapper users,
            TradeOrderMapper orders,CustomRequestMapper requests,OrderPaymentMapper payments,OrderFulfillmentMapper fulfillment,
            ConversationMapper conversations,FileAssetMapper files,CustomRequestPolicyService policy,
            RefundApplicationService applications,OrderRefundExecutionService execution,OperationLogService logs,
            NotificationService notifications,ConversationService events,PrivateImageStorage storage,ObjectMapper json){
        this.adminData=adminData;this.refunds=refunds;this.users=users;this.orders=orders;this.requests=requests;this.payments=payments;
        this.fulfillment=fulfillment;this.conversations=conversations;this.files=files;this.policy=policy;this.applications=applications;
        this.execution=execution;this.logs=logs;this.notifications=notifications;this.events=events;this.storage=storage;this.json=json;
    }

    @Override @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public PageVO<AdminRefundQueueVO> list(Long actor,AdminRefundQueryDTO query){return BusinessLog.run(LOGGER,"管理员售后队列查询",actor,()->{
        admin(actor);
        var items=adminData.queue(query,(query.getPage()-1)*query.getSize()).stream().map(r->{var o=order(r);return new AdminRefundQueueVO(
                text(r.getId()),text(o.getId()),o.getOrderNo(),o.getTitleSnapshot(),text(o.getBuyerId()),text(o.getCreatorId()),r.getApplicationType(),
                r.getOriginalOrderStatus(),r.getReasonCode(),r.getStatus(),r.getVersion(),time(r.getCreatedAt()),time(r.getFinishedAt()),amount(o.getTotalAmount()));}).toList();
        return new PageVO<>(items,adminData.count(query),query.getPage(),query.getSize());
    });}

    @Override @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public AdminRefundDetailVO detail(Long actor,Long id){return BusinessLog.run(LOGGER,"管理员售后查证",actor,()->{
        admin(actor);var refund=find(id);var order=order(refund);var now=policy.now().truncatedTo(ChronoUnit.MILLIS);
        var payment=payments.payment(order.getId());var settlement=payments.settlement(order.getId());var chat=conversation(order);
        var buyer=users.findById(order.getBuyerId());var creator=users.findById(order.getCreatorId());
        var nodes=payments.nodes(order.getId()).stream().map(n->{
            var records=fulfillment.records(n.getId()).stream().map(r->new OrderProgressRecordVO(text(r.getId()),r.getRequestKey(),r.getRecordType(),r.getContent(),ids(r.getImageIds()),r.getSkipReason(),time(r.getCreatedAt()))).toList();
            long deviation=n.getPlannedFinishDate()==null?0:ChronoUnit.DAYS.between(n.getPlannedFinishDate(),n.getHandledAt()==null?now.toLocalDate():n.getHandledAt().toLocalDate());
            return new OrderProgressNodeVO(text(n.getId()),n.getNodeCode(),n.getSortOrder(),n.getPlannedFinishDate(),n.getStatus(),time(n.getHandledAt()),records,false,false,false,deviation,n.getHandledAt()==null&&deviation>0);
        }).toList();
        var paymentSummary=new LinkedHashMap<String,Object>();if(payment!=null){paymentSummary.put("flowNo",payment.getFlowNo());paymentSummary.put("amount",amount(payment.getAmount()));paymentSummary.put("occurredAt",time(payment.getOccurredAt()));}
        var settlementSummary=new LinkedHashMap<String,Object>();if(settlement!=null){settlementSummary.put("paidAmount",amount(settlement.getPaidAmount()));settlementSummary.put("status",settlement.getStatus());}
        var orderView=new AdminRefundOrderVO(text(order.getId()),order.getOrderNo(),order.getTitleSnapshot(),order.getStatus(),text(order.getBuyerId()),buyer==null?null:buyer.getNickname(),text(order.getCreatorId()),creator==null?null:creator.getNickname(),text(order.getRequestId()),text(order.getQuoteId()),amount(order.getTotalAmount()),map(order.getAgreementSnapshot()),address(order),time(order.getPaidAt()),time(order.getStartedAt()),time(order.getShipDeadlineAt()),order.getTrackingNo(),time(order.getShippedAt()),time(order.getAutoConfirmAt()),time(order.getOriginalCompletedAt()),chat==null?null:text(chat.getId()),paymentSummary,settlementSummary,nodes);
        var history=adminData.history(order.getId()).stream().map(h->new AdminRefundHistoryVO(text(h.getId()),text(h.getOperatorId()),h.getOperatorType(),h.getAction(),h.getBeforeStatus(),h.getAfterStatus(),h.getReason(),map(h.getDetail()),time(h.getCreatedAt()))).toList();
        var app=new RefundApplicationVO(text(refund.getId()),text(order.getId()),order.getOrderNo(),text(order.getBuyerId()),text(order.getCreatorId()),refund.getApplicationType(),refund.getOriginalOrderStatus(),refund.getReasonCode(),refund.getDescription(),ids(refund.getImageIds()),refund.getStatus(),refund.getCreateRequestKey(),refund.getVersion(),time(refund.getCreatedAt()),time(refund.getFinishedAt()),text(refund.getHandlerId()),refund.getDecisionReason(),refund.getReturnRequired(),refund.getReturnTrackingNo(),time(refund.getReturnConfirmedAt()),text(refund.getReturnConfirmedBy()),refund.getNoReturnBasis(),false,false,payment==null?null:amount(payment.getAmount()),chat==null?null:text(chat.getId()));
        var decision=adminData.decision(id);
        return new AdminRefundDetailVO(app,orderView,history,"NORMAL".equals(refund.getApplicationType())&&"WAIT_ADMIN".equals(refund.getStatus())&&"AFTER_SALE".equals(order.getStatus()),time(now),decision==null?null:map(decision.getDetail()));
    });}

    @Override @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public RefundEvidencePageVO evidence(Long actor,Long id,Long cursor,int size){return BusinessLog.run(LOGGER,"管理员售后补证查询",actor,()->{
        admin(actor);order(find(id));page(size);if(cursor!=null&&cursor<0)throw invalid("补证游标无效");
        var list=refunds.evidence(id,cursor==null?0:cursor,size+1);boolean more=list.size()>size;
        var items=list.stream().limit(size).map(e->new RefundEvidenceVO(text(e.getId()),text(e.getRefundApplicationId()),text(e.getSubmitterId()),e.getContent(),ids(e.getImageIds()),e.getRequestKey(),time(e.getCreatedAt()))).toList();
        return new RefundEvidencePageVO(items,more?items.get(items.size()-1).id():null,more);
    });}

    @Override @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public ChatMessagePageVO messages(Long actor,Long id,Long before,Long after,int size){return BusinessLog.run(LOGGER,"管理员订单会话只读查证",actor,()->{
        admin(actor);var order=order(find(id));page(size);
        if(before!=null&&before<=0||after!=null&&after<0||before!=null&&after!=null)throw invalid("会话游标无效或方向冲突");
        var chat=conversation(order);if(chat==null)throw missing();
        var found=conversations.messages(chat.getId(),before,after,size+1);boolean more=found.size()>size;
        var limited=new ArrayList<>(found.stream().limit(size).toList());if(after==null)Collections.reverse(limited);
        return new ChatMessagePageVO(limited.stream().map(m->new ChatMessageVO(text(m.getId()),text(m.getConversationId()),text(m.getSeqNo()),text(m.getSenderId()),m.getClientMessageKey(),m.getContent(),ids(m.getImageIds()),time(m.getCreatedAt()),text(m.getReferencedNodeId()),m.getReferencedNodeCode())).toList(),more);
    });}

    @Override @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public ImageVO image(Long actor,Long id,Long fileId){return BusinessLog.run(LOGGER,"管理员售后上下文私图签名",actor,()->{
        admin(actor);var order=order(find(id));var file=files.findById(fileId);
        if(file==null||!"AVAILABLE".equals(file.getUploadStatus())||!adminData.imageReferenced(order.getId(),fileId))throw missing();
        return storage.signed(file);
    });}

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public void decide(Long actor,Long id,AdminRefundDecisionDTO input){BusinessLog.run(LOGGER,"管理员售后裁定",actor,()->{
        try{
            admin(actor);var initial=find(id);var original=order(initial);
            // 管理员也参与账号升序锁，避免角色变更与双管理员裁定绕过同一竞争锁。
            policy.lockUsers(actor,original.getBuyerId(),original.getCreatorId());admin(actor);
            var request=requests.lock(original.getRequestId());var order=orders.lock(original.getId());var refund=refunds.lock(id);
            if(order==null||refund==null||request==null||!Objects.equals(order.getId(),refund.getOrderId())||!Objects.equals(request.getBuyerId(),order.getBuyerId()))throw conflict("订单与原需求或申请关联不一致");
            var facts=facts(input);
            if(!"WAIT_ADMIN".equals(refund.getStatus())){
                var prior=adminData.decision(id);
                // JSON解析统一整数节点类型，避免Long输入和数据库小整数反序列化差异破坏相同事实重试。
                if(prior!=null&&Objects.equals(actor,prior.getOperatorId())&&json.readTree(json.writeValueAsString(facts)).equals(json.readTree(prior.getDetail())))return null;
                throw conflict("该申请已有其他终局结果，不能覆盖裁定");
            }
            if(!"NORMAL".equals(refund.getApplicationType())||!"AFTER_SALE".equals(order.getStatus()))throw conflict("当前申请不可由管理员裁定");
            if(!Objects.equals(input.getExpectedVersion(),refund.getVersion()))throw conflict("已有新的补证，请重新查阅后确认裁定");
            LOGGER.info("管理员售后裁定锁后校验完成：adminId={}, orderId={}, refundId={}, version={}",actor,order.getId(),id,refund.getVersion());
            boolean approved="APPROVE".equals(input.getDecision());
            // 所有上游锁在可能读取凭证文件锁之前取得，公共资金执行不再补取上游锁。
            var context=approved?execution.lockContext(order):null;
            var now=policy.now().truncatedTo(ChronoUnit.MILLIS);
            if(approved){returnFacts(actor,order,refund,input,now);if(adminData.returnFacts(refund)!=1)throw conflict("售后状态已变化");}
            refund.setHandlerId(actor);refund.setDecisionReason(input.getReason());refund.setFinishedAt(now);
            if(approved){execution.execute(actor,true,request,order,refund,context,now,"NORMAL_REFUND",Map.of("refundId",id.toString()));}
            else{
                refund.setStatus("REJECTED");if(refunds.updateTerminal(refund)!=1)throw conflict("售后状态已变化");applications.restore(order,refund,now);
                notifications.refundChanged(order.getBuyerId(),"REFUND_REJECTED",id,order.getId(),order.getRequestId());
                notifications.refundChanged(order.getCreatorId(),"REFUND_REJECTED",id,order.getId(),order.getRequestId());events.orderChanged(order);
            }
            logs.record(actor,true,"REFUND_APPLICATION",id,"ADMIN_REFUND_DECISION","WAIT_ADMIN",approved?"REFUNDED":"REJECTED",input.getReason(),facts);
            LOGGER.info("管理员裁定原子结果已准备：adminId={}, refundId={}, stage=等待事务提交",actor,id);return null;
        }catch(BusinessException failure){LOGGER.warn("管理员售后裁定拒绝：stage=权限版本与退回核验, adminId={}, refundId={}, reason={}",actor,id,failure.getMessage());throw failure;}
        catch(RuntimeException failure){LOGGER.error("管理员售后裁定失败：stage=原子持久化, adminId={}, refundId={}",actor,id,SafeLog.exception(failure));throw failure;}
    });}

    /** 原输入事实用于终局幂等，不包含金额、账号、服务端核实时刻等客户端不可决定字段。 */
    private Map<String,Object> facts(AdminRefundDecisionDTO input){
        var result=new LinkedHashMap<String,Object>();result.put("expectedVersion",input.getExpectedVersion());result.put("decision",input.getDecision());result.put("reason",input.getReason());result.put("returnRequired",input.getReturnRequired());result.put("returnedConfirmed",input.getReturnedConfirmed());result.put("returnTrackingNo",input.getReturnTrackingNo());result.put("returnEvidenceImageIds",input.getReturnEvidenceImageIds());result.put("noReturnBasis",input.getNoReturnBasis());return result;
    }
    private void returnFacts(Long actor,TradeOrder order,RefundApplication refund,AdminRefundDecisionDTO input,LocalDateTime now){
        boolean shipped=order.getShippedAt()!=null||Set.of("SHIPPED","COMPLETED").contains(refund.getOriginalOrderStatus());
        if(!shipped){refund.setReturnRequired(false);refund.setNoReturnBasis("系统核验：本单从未发货，无需退回原成品。");return;}
        if(input.getReturnRequired()==null)throw invalid("曾发货订单批准退款须选择是否需退货");
        refund.setReturnRequired(input.getReturnRequired());
        if(!input.getReturnRequired()){
            if(input.getNoReturnBasis()==null||input.getNoReturnBasis().isBlank())throw invalid("无需退货须填写核实依据");
            if(Boolean.TRUE.equals(input.getReturnedConfirmed())||input.getReturnTrackingNo()!=null||!input.getReturnEvidenceImageIds().isEmpty())throw invalid("无需退货不得同时提交退回确认或退回凭证");
            refund.setNoReturnBasis(input.getNoReturnBasis());return;
        }
        if(!Boolean.TRUE.equals(input.getReturnedConfirmed()))throw invalid("需明确确认原成品已经退回");
        if(input.getNoReturnBasis()!=null&&!input.getNoReturnBasis().isBlank())throw invalid("需要退货不得同时填写免退依据");
        if(input.getReturnTrackingNo()==null&&input.getReturnEvidenceImageIds().isEmpty())throw invalid("退回核验须提供退回单号或当前申请已保存的凭证图片");
        var allowed=new HashSet<>(ids(refund.getImageIds()));for(var evidence:refunds.allEvidence(refund.getId()))allowed.addAll(ids(evidence.getImageIds()));
        if(new HashSet<>(input.getReturnEvidenceImageIds()).size()!=input.getReturnEvidenceImageIds().size()||!allowed.containsAll(input.getReturnEvidenceImageIds()))throw invalid("退回凭证只能引用当前申请初始或补充凭证图片");
        input.getReturnEvidenceImageIds().stream().map(this::number).sorted().forEach(fileId->{var file=files.lockById(fileId);if(file==null||!"AVAILABLE".equals(file.getUploadStatus()))throw invalid("所选退回凭证图片不可用");});
        refund.setReturnTrackingNo(input.getReturnTrackingNo());refund.setReturnConfirmedAt(now);refund.setReturnConfirmedBy(actor);
    }
    private void admin(Long actor){var user=users.findById(actor);if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);if(!user.isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN,"仅管理员可以查证和裁定售后");}
    private RefundApplication find(Long id){var refund=refunds.find(id);if(refund==null)throw missing();return refund;}
    private TradeOrder order(RefundApplication refund){var order=orders.find(refund.getOrderId());if(order==null||!"CUSTOM".equals(order.getOrderType())||!Objects.equals(order.getBuyerId(),refund.getBuyerId()))throw missing();return order;}
    private Conversation conversation(TradeOrder order){var chat=conversations.byRequest(order.getRequestId(),order.getCreatorId());return chat!=null&&Objects.equals(chat.getOrderId(),order.getId())&&Objects.equals(chat.getBuyerId(),order.getBuyerId())?chat:null;}
    private Map<String,Object> address(TradeOrder order){var source=map(order.getAddressSnapshot());var safe=new LinkedHashMap<String,Object>();for(String key:List.of("recipientName","phone","province","city","district","detailAddress"))if(source.containsKey(key))safe.put(key,source.get(key));return safe;}
    private void page(int size){if(size<1||size>50)throw invalid("每页数量须为1至50");}
    private Long number(String value){try{long id=Long.parseLong(value);if(id>0)return id;}catch(NumberFormatException ignored){}throw invalid("图片编号无效");}
    private List<String> ids(String raw){return raw==null?List.of():json.readValue(raw,new TypeReference<List<String>>(){});}
    private Map<String,Object> map(String raw){return raw==null?Map.of():json.readValue(raw,new TypeReference<Map<String,Object>>(){});}
    private static String text(Long value){return value==null?null:value.toString();}
    private static String amount(BigDecimal value){return value==null?null:value.setScale(2).toPlainString();}
    private static OffsetDateTime time(LocalDateTime value){return value==null?null:value.atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime();}
    private static BusinessException invalid(String message){return new BusinessException(CommonErrorCode.INVALID_REQUEST,message);}
    private static BusinessException conflict(String message){return new BusinessException(CommonErrorCode.CONFLICT,message);}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
}
