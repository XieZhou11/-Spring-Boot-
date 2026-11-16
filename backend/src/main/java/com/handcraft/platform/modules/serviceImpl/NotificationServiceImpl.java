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
