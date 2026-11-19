package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.entity.SystemNotification;
import com.handcraft.platform.modules.mapper.SystemNotificationMapper;
import com.handcraft.platform.modules.security.NotificationSocketHandler;
import com.handcraft.platform.modules.service.NotificationService;
import com.handcraft.platform.modules.vo.*;
import java.time.*;
import java.util.*;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** 通知和业务同事务保存；提交后尽力推送，失败通过列表补偿。 */
@Service
public class NotificationServiceImpl implements NotificationService {
    private final SystemNotificationMapper notices;
    private final NotificationSocketHandler socket;
    private final ObjectMapper json;
    public NotificationServiceImpl(SystemNotificationMapper notices,NotificationSocketHandler socket,ObjectMapper json){this.notices=notices;this.socket=socket;this.json=json;}
    @Transactional(propagation=Propagation.MANDATORY)
    public void fulfillmentChanged(Long recipientId,String eventType,Long eventId,Long orderId,Long requestId){
        BusinessLog.run(LoggerFactory.getLogger(getClass()),"订单履约通知保存",recipientId,()->{
            String key=eventType+":"+eventId;if(notices.event(recipientId,key)!=null)return null;
            String title=switch(eventType){
                case "ORDER_STARTED" -> "定制订单已开工";
                case "ORDER_PROGRESS" -> "制作进度已更新";
                case "ORDER_SHIPPED" -> "订单已发货";
                case "ORDER_TRACKING_CORRECTED" -> "订单运单号已更正";
                case "ORDER_RECEIVED" -> "订单已确认收货";
                case "ORDER_NO_START_REFUNDED" -> "未开工订单已无责退款";
                case "ORDER_SHIPPING_OVERDUE" -> "订单发货已超期";
                default -> throw new IllegalArgumentException("不支持的履约通知事件");
            };
            var n=new SystemNotification();n.setRecipientId(recipientId);n.setEventType(eventType);n.setEventKey(key);n.setTitle(title);
            n.setContent(title+"，请查看订单详情。");
            n.setBusinessReference(json.writeValueAsString(Map.of("type","ORDER","id",orderId.toString(),"requestId",requestId.toString())));
            notices.insert(n);afterCommit(()->{socket.publish(recipientId,Map.of("type","SYSTEM_NOTIFICATION","notification",view(notices.find(n.getId()))));publishUnread(recipientId);});return null;
        });
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void tradeChanged(Long recipientId,String eventType,String businessType,Long businessId,Long requestId){
        BusinessLog.run(LoggerFactory.getLogger(getClass()),"报价订单通知保存",recipientId,()->{
            String eventKey=eventType+":"+businessId;
            if(notices.event(recipientId,eventKey)!=null)return null;
            String title=switch(eventType){
                case "QUOTE_SUBMITTED" -> "报价已提交";
                case "QUOTE_WITHDRAWN" -> "报价已撤回";
                case "QUOTE_EXPIRED" -> "报价已失效";
                case "QUOTE_AWARDED" -> "报价已中标";
                case "QUOTE_LOST" -> "报价未中标";
                case "ORDER_CREATED" -> "定制订单已创建";
                case "ORDER_CANCELLED" -> "定制订单已取消";
                case "ORDER_PAID" -> "定制订单已付款";
                default -> throw new IllegalArgumentException("不支持的交易通知事件");
            };
            var notice=new SystemNotification();notice.setRecipientId(recipientId);notice.setEventType(eventType);notice.setEventKey(eventKey);
            notice.setTitle(title);notice.setContent("QUOTE_LOST".equals(eventType)?"买家已选择其他方案，可查看本人报价及历史沟通。":title+"，请查看对应业务详情。");
            var reference=new LinkedHashMap<String,String>();reference.put("type",businessType);reference.put("id",businessId.toString());
            if(requestId!=null)reference.put("requestId",requestId.toString());
            notice.setBusinessReference(json.writeValueAsString(reference));notices.insert(notice);
            afterCommit(()->{socket.publish(recipientId,Map.of("type","SYSTEM_NOTIFICATION","notification",view(notices.find(notice.getId()))));publishUnread(recipientId);});
            return null;
        });
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void customRequestChanged(Long recipientId,Long requestId,String eventType){BusinessLog.run(LoggerFactory.getLogger(getClass()),"定制需求通知保存",recipientId,()->{
        String key=eventType+":"+requestId;if(notices.event(recipientId,key)!=null)return null;
        var n=new SystemNotification();n.setRecipientId(recipientId);n.setEventType(eventType);n.setEventKey(key);
        n.setTitle(switch(eventType){case "REQUEST_INVITED"->"收到定向需求邀约";case "REQUEST_CLOSED"->"定制需求已关闭";default->"定制需求已过期";});
        n.setContent(switch(eventType){case "REQUEST_INVITED"->"你被指定为该需求的唯一受邀创作者，请查看需求详情。";case "REQUEST_CLOSED"->"需求已关闭，未形成订单的相关会话已归档，可查看历史记录。";default->"需求发布已满七天且无有效报价，已过期；未成单会话已归档。";});
        n.setBusinessReference(json.writeValueAsString(Map.of("type","CUSTOM_REQUEST","id",requestId.toString())));notices.insert(n);
        afterCommit(()->{socket.publish(recipientId,Map.of("type","SYSTEM_NOTIFICATION","notification",view(notices.find(n.getId()))));publishUnread(recipientId);});return null;
    });}
    @Transactional(propagation=Propagation.MANDATORY)
    public void workChanged(Long recipientId,Long workId,Long submittedVersion,String eventType,String decision,String reason){BusinessLog.run(LoggerFactory.getLogger(getClass()),"作品状态通知保存",recipientId,()->{
        var n=new SystemNotification();n.setRecipientId(recipientId);n.setEventType(eventType);n.setEventKey(eventType+":"+workId+":"+submittedVersion);
        boolean offline="WORK_OFFLINED".equals(eventType);boolean approved="APPROVED".equals(decision);
        n.setTitle(offline?"作品已下架":approved?"作品审核已通过":"作品审核未通过");
        String content=offline?"管理员已下架作品，请查看原因。":approved?"作品已上架，可在作品管理中查看。":"作品需补正，请查看审核原因。";
        // 下架和驳回均携带具体原因，独立拼接避免嵌套条件表达式遗漏分支。
        if((offline||!approved)&&reason!=null&&!reason.isBlank())content+="原因："+reason;
        n.setContent(content);
        n.setBusinessReference(json.writeValueAsString(Map.of("type","WORK","id",workId.toString(),"version",submittedVersion.toString())));notices.insert(n);
        afterCommit(()->{socket.publish(recipientId,Map.of("type","SYSTEM_NOTIFICATION","notification",view(notices.find(n.getId()))));publishUnread(recipientId);});return null;
    });}
    @Transactional(propagation=Propagation.MANDATORY)
    public void creatorReviewed(Long recipientId,Long applicationId,String decision,String reason){BusinessLog.run(LoggerFactory.getLogger(getClass()),"认证审核通知保存",recipientId,()->{
        var n=new SystemNotification();n.setRecipientId(recipientId);n.setEventType("CREATOR_APPLICATION_REVIEWED");n.setEventKey("CREATOR_REVIEW:"+applicationId);n.setTitle("APPROVED".equals(decision)?"创作者认证已通过":"创作者申请需补正");
        n.setContent("APPROVED".equals(decision)?"你的创作者认证已通过，可以切换创作者身份。":"申请被驳回，请查看原因并补正材料。"+(reason.isBlank()?"":"原因："+reason));n.setBusinessReference(json.writeValueAsString(Map.of("type","CREATOR_APPLICATION","id",applicationId.toString())));notices.insert(n);
        afterCommit(()->{socket.publish(recipientId,Map.of("type","SYSTEM_NOTIFICATION","notification",view(notices.find(n.getId()))));publishUnread(recipientId);});return null;
    });}
    public PageVO<NotificationVO> list(Long userId,int page,int size){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"本人通知查询",userId,()->{
        if(page<1||page>1_000_000||size<1||size>50)throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"分页参数无效");
        return new PageVO<>(notices.list(userId,(page-1)*size,size).stream().map(this::view).toList(),notices.count(userId),page,size);
    });}
    public long unread(Long userId){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"未读通知查询",userId,()->notices.unread(userId));}
    @Transactional(rollbackFor=Exception.class)
    public NotificationVO read(Long userId,Long id){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"通知标记已读",userId,()->{
        var n=notices.find(id);if(n==null||!userId.equals(n.getRecipientId()))throw new BusinessException(CommonErrorCode.NOT_FOUND);
        notices.read(userId,id);afterCommit(()->publishUnread(userId));return view(notices.find(id));
    });}
    private void publishUnread(Long id){socket.publish(id,Map.of("type","UNREAD_UPDATED","count",notices.unread(id)));}
    private void afterCommit(Runnable action){TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){public void afterCommit(){try{action.run();}catch(RuntimeException e){LoggerFactory.getLogger(NotificationServiceImpl.class).error("审核通知推送异常：stage=事务提交后，持久化通知仍可查询",SafeLog.exception(e));}}});}
    private NotificationVO view(SystemNotification n){return new NotificationVO(n.getId().toString(),n.getEventType(),n.getTitle(),n.getContent(),json.readValue(n.getBusinessReference(),new TypeReference<Map<String,String>>(){}),time(n.getReadAt()),time(n.getCreatedAt()));}
    private static OffsetDateTime time(LocalDateTime t){return t==null?null:t.atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime();}
}
