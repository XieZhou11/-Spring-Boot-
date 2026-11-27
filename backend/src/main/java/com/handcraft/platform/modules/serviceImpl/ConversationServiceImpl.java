package com.handcraft.platform.modules.serviceImpl;
import com.handcraft.platform.common.content.PlainTextPolicy;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.dto.ChatMessageDTO;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.exception.ChatRateLimitException;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.security.NotificationSocketHandler;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.*;
import java.time.*;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
/** 需求→会话行锁保证发送与关闭互斥，发送账号锁维护跨会话幂等键。 */
@Service
public class ConversationServiceImpl implements ConversationService {
    private static final Logger LOGGER=LoggerFactory.getLogger(ConversationServiceImpl.class);
    private final ConversationMapper conversations;private final CustomRequestMapper requests;private final UserAccountMapper users;private final FileAssetMapper files;private final CustomRequestPolicyService policy;private final NotificationSocketHandler socket;private final ObjectMapper json;private final AvatarService avatars;
    public ConversationServiceImpl(ConversationMapper conversations,CustomRequestMapper requests,UserAccountMapper users,FileAssetMapper files,CustomRequestPolicyService policy,NotificationSocketHandler socket,ObjectMapper json,AvatarService avatars){this.conversations=conversations;this.requests=requests;this.users=users;this.files=files;this.policy=policy;this.socket=socket;this.json=json;this.avatars=avatars;}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Creation create(Long userId,Long requestId){return BusinessLog.run(LOGGER,"需求沟通会话创建",userId,()->{
        var initial=requests.find(requestId);policy.visible(userId,initial,false);Long creator=userId.equals(initial.getBuyerId())?initial.getInvitedCreatorId():userId;if(creator==null||creator.equals(initial.getBuyerId()))throw forbidden("公开需求由合资格创作者发起咨询，请在消息中心查看已建立的会话");
        // 已建关系优先返回，即使暂停或需求结束，也能进入历史和必要订单沟通。
        var prior=conversations.byRequest(requestId,creator);if(prior!=null){participant(userId,prior);return new Creation(view(prior,userId),false);}
        BusinessException categoryFailure = null;
        try { policy.lockTradingCategory(initial.getCategoryId()); }
        catch (BusinessException failure) { categoryFailure = failure; }
        policy.lockUsers(initial.getBuyerId(),creator);var r=requests.lock(requestId);policy.visible(userId,r,false);var existing=conversations.byRequest(requestId,creator);if(existing!=null){participant(userId,existing);return new Creation(view(existing,userId),false);}
        // 如果等待账号锁时草稿换类并发布，重新提交以取得当前品类的锁。
        if (!Objects.equals(initial.getCategoryId(), r.getCategoryId())) throw conflict("需求品类已变化，请刷新需求状态");
        if (categoryFailure != null) throw categoryFailure;
        policy.open(r);
        if("DIRECTED".equals(r.getVisibility())&&!creator.equals(r.getInvitedCreatorId()))throw missing();var buyer=policy.user(r.getBuyerId());if(buyer.isAdminBusinessPaused())throw forbidden("需求买家已暂停新业务，不能新建咨询");String reason=policy.creatorReason(users.findById(creator),r.getCategoryId());if(reason!=null)throw forbidden(reason);
        var c=new Conversation();c.setBuyerId(r.getBuyerId());c.setCreatorId(creator);c.setRequestId(requestId);c.setLastMessageAt(policy.now());c.setCreatedAt(policy.now());conversations.insert(c);var saved=conversations.find(c.getId());afterCommit(()->both(saved,Map.of("type","CONVERSATION_UPDATED","conversationId",saved.getId().toString())));LOGGER.info("会话关系已校验：requestId={}, conversationId={}",requestId,c.getId());return new Creation(view(saved,userId),true);
    });}
    @Transactional(propagation=Propagation.MANDATORY,rollbackFor=Exception.class)
    public Long linkOrder(CustomRequest request,TradeOrder order){return BusinessLog.run(LOGGER,"定标订单会话关联",order.getBuyerId(),()->{
        var persisted=conversations.order(order.getId());
        if(persisted==null||!"CUSTOM".equals(persisted.getOrderType())||!Objects.equals(request.getId(),persisted.getRequestId())||!Objects.equals(request.getBuyerId(),persisted.getBuyerId())||!Objects.equals(order.getCreatorId(),persisted.getCreatorId()))throw conflict("订单与需求或中标创作者的关联不一致");
        // 上游账号、需求及订单锁由定标事务持有，再按会话编号升序锁定全部已有咨询。
        var locked=conversations.forRequest(request.getId()).stream().map(current->conversations.lock(current.getId())).toList();
        Conversation winner=null;
        for(var current:locked){
            if(!Objects.equals(current.getBuyerId(),persisted.getBuyerId()))throw conflict("需求会话买家与订单不一致");
            if(Objects.equals(current.getCreatorId(),persisted.getCreatorId()))winner=current;
        }
        LocalDateTime now=policy.now();
        if(winner==null){
            winner=new Conversation();winner.setBuyerId(persisted.getBuyerId());winner.setCreatorId(persisted.getCreatorId());winner.setRequestId(request.getId());winner.setOrderId(persisted.getId());winner.setCreatedAt(now);winner.setLastMessageAt(now);conversations.insert(winner);
            Conversation created=winner;afterCommit(()->both(created,Map.of("type","CONVERSATION_UPDATED","conversationId",created.getId().toString())));
        }else{
            if(winner.getOrderId()!=null&&!Objects.equals(winner.getOrderId(),persisted.getId()))throw conflict("原需求会话已经关联其他订单");
            if(winner.getOrderId()==null||winner.getArchivedAt()!=null){
                if(conversations.linkOrder(winner.getId(),persisted.getId(),now)!=1)throw conflict("订单会话关联状态已变化");
                Conversation linked=winner;afterCommit(()->both(linked,Map.of("type","CONVERSATION_UPDATED","conversationId",linked.getId().toString())));
            }
        }
        for(var current:locked){
            if(!current.getId().equals(winner.getId())&&current.getOrderId()==null&&current.getArchivedAt()==null&&conversations.archiveLoser(current.getId(),now)==1){
                afterCommit(()->both(current,Map.of("type","CONVERSATION_UPDATED","conversationId",current.getId().toString())));
            }
        }
        LOGGER.info("定标会话变更等待提交：requestId={}, orderId={}, conversationId={}",request.getId(),persisted.getId(),winner.getId());
        return winner.getId();
    });}
    @Transactional(propagation=Propagation.MANDATORY,rollbackFor=Exception.class)
    public Long createStockOrder(TradeOrder order){return BusinessLog.run(LOGGER,"现货订单会话创建",order.getBuyerId(),()->{
        if(!"STOCK".equals(order.getOrderType())||order.getRequestId()!=null||order.getBuyerId().equals(order.getCreatorId()))throw conflict("现货订单关联信息无效");
        var existing=conversations.byOrder(order.getId());if(existing!=null)return existing.getId();
        var c=new Conversation();c.setBuyerId(order.getBuyerId());c.setCreatorId(order.getCreatorId());c.setOrderId(order.getId());c.setLastMessageAt(order.getCreatedAt());c.setCreatedAt(order.getCreatedAt());
        conversations.insert(c);var saved=conversations.find(c.getId());
        afterCommit(()->both(saved,Map.of("type","CONVERSATION_UPDATED","conversationId",saved.getId().toString(),"orderId",order.getId().toString())));
        LOGGER.info("现货订单会话已准备：orderId={}, conversationId={}",order.getId(),saved.getId());return saved.getId();
    });}
    @Transactional(propagation=Propagation.MANDATORY)
    public void orderChanged(TradeOrder order){BusinessLog.run(LOGGER,"订单会话状态同步",order.getBuyerId(),()->{
        var initial="STOCK".equals(order.getOrderType())?conversations.byOrder(order.getId()):conversations.byRequest(order.getRequestId(),order.getCreatorId());
        if(initial==null)throw conflict("订单关联会话不存在");
        var conversation=conversations.lock(initial.getId());
        if(!Objects.equals(order.getId(),conversation.getOrderId())||!Objects.equals(order.getBuyerId(),conversation.getBuyerId()))throw conflict("订单关联会话不一致");
        // 订单编号仅作刷新定位，接收方仍须重新查询详情并鉴权；同步创作者其他设备的履约视图。
        afterCommit(()->both(conversation,Map.of("type","CONVERSATION_UPDATED","conversationId",conversation.getId().toString(),"orderId",order.getId().toString())));
        LOGGER.info("订单会话状态同步已准备：orderId={}, conversationId={}, stage=提交后刷新",order.getId(),conversation.getId());return null;
    });}
    public PageVO<ConversationVO> list(Long userId,int page,int size){return BusinessLog.run(LOGGER,"本人会话列表查询",userId,()->{policy.user(userId);page(page,size);return new PageVO<>(conversations.list(userId,(page-1)*size,size).stream().map(c->view(c,userId)).toList(),conversations.count(userId),page,size);});}
    public ConversationVO detail(Long userId,Long id){return BusinessLog.run(LOGGER,"会话详情查询",userId,()->{policy.user(userId);var c=conversations.find(id);participant(userId,c);return view(c,userId);});}
    public long unread(Long userId){return BusinessLog.run(LOGGER,"会话未读总数查询",userId,()->{policy.user(userId);return conversations.unread(userId);});}
    public ChatMessagePageVO messages(Long userId,Long id,Long before,Long after,int size){return BusinessLog.run(LOGGER,"会话消息补拉",userId,()->{
        policy.user(userId);participant(userId,conversations.find(id));if(size<1||size>50||before!=null&&before<1||after!=null&&after<0||before!=null&&after!=null)throw invalid("消息分页参数无效，前后游标不能同时提供");var selected=new ArrayList<>(conversations.messages(id,before,after,size+1));boolean more=selected.size()>size;if(more)selected.removeLast();selected.sort(Comparator.comparing(ChatMessage::getSeqNo));return new ChatMessagePageVO(selected.stream().map(this::message).toList(),more);
    });}
    @Transactional(rollbackFor=Exception.class,noRollbackFor=ChatRateLimitException.class,isolation=Isolation.READ_COMMITTED)
    public Sent send(Long userId,Long id,ChatMessageDTO in){return BusinessLog.run(LOGGER,"会话消息发送",userId,()->{
        policy.user(userId);var initial=conversations.find(id);participant(userId,initial);policy.lockUsers(userId);if(initial.getRequestId()!=null)requests.lock(initial.getRequestId());var c=conversations.lock(id);participant(userId,c);String content=normalize(in.getContent());String imageIds=json.writeValueAsString(in.getImageIds());Long nodeId=in.getReferencedNodeId()==null?null:number(in.getReferencedNodeId());
        var previous=conversations.messageKey(userId,in.getClientMessageKey());if(previous!=null){if(!id.equals(previous.getConversationId())||!Objects.equals(content,previous.getContent())||!ids(previous.getImageIds()).equals(in.getImageIds())||!Objects.equals(nodeId,previous.getReferencedNodeId()))throw conflict("同一消息请求键不能更改会话、文字、图片或节点引用");return new Sent(message(previous),false);}
        String disabled=disabled(c);if(disabled!=null)throw conflict(disabled);if(content==null&&in.getImageIds().isEmpty())throw invalid("文字和图片不能同时为空");if(!PlainTextPolicy.safe(content))throw invalid("消息不能包含脚本、联系方式、外链、站外引流或不当内容");
        String nodeCode=null;if(nodeId!=null){nodeCode=c.getOrderId()==null?null:conversations.nodeCode(nodeId,c.getOrderId());if(nodeCode==null)throw invalid("只能引用本会话关联订单的制作节点");}
        LocalDateTime now=policy.now();boolean buyer=userId.equals(c.getBuyerId());var until=buyer?c.getBuyerCooldownUntil():c.getCreatorCooldownUntil();if(until!=null&&now.isBefore(until))throw new ChatRateLimitException(Math.max(1,(int)Math.ceil(Duration.between(now,until).toMillis()/1000d)));
        if(conversations.sentSince(id,userId,now.minusSeconds(60))>=20){if(buyer)c.setBuyerCooldownUntil(now.plusSeconds(60));else c.setCreatorCooldownUntil(now.plusSeconds(60));c.setUpdatedAt(now);conversations.update(c);LOGGER.warn("会话发送限流，冷却将提交：userId={}, conversationId={}, stage=成功消息窗口计数",userId,id);throw new ChatRateLimitException(60);}
        if(content!=null&&conversations.repeatedText(id,userId,now.minusSeconds(10),content)>0)throw conflict("十秒内不能重复发送相同文字");checkImages(userId,id,in.getImageIds());
        var m=new ChatMessage();m.setConversationId(id);m.setSeqNo(c.getLastMessageSeq()+1);m.setSenderId(userId);m.setClientMessageKey(in.getClientMessageKey());m.setContent(content);m.setImageIds(imageIds);m.setReferencedNodeId(nodeId);m.setReferencedNodeCode(nodeCode);m.setCreatedAt(now);conversations.insertMessage(m);c.setLastMessageSeq(m.getSeqNo());c.setLastMessageAt(now);c.setUpdatedAt(now);conversations.update(c);var saved=message(m);afterCommit(()->{both(c,Map.of("type","CHAT_MESSAGE","message",saved));publishUnread(c.getBuyerId());publishUnread(c.getCreatorId());});LOGGER.info("消息已持久化，等待事务提交：userId={}, conversationId={}, messageId={}, seqNo={}",userId,id,m.getId(),m.getSeqNo());return new Sent(saved,true);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public ConversationVO read(Long userId,Long id,Long seq){return BusinessLog.run(LOGGER,"会话已读游标推进",userId,()->{
        policy.user(userId);policy.lockUsers(userId);var c=conversations.lock(id);participant(userId,c);if(seq==null||seq<0||seq>c.getLastMessageSeq())throw invalid("已读序号不能超过已有消息");boolean buyer=userId.equals(c.getBuyerId());long current=buyer?c.getBuyerReadSeq():c.getCreatorReadSeq();if(seq>current){if(buyer)c.setBuyerReadSeq(seq);else c.setCreatorReadSeq(seq);c.setUpdatedAt(policy.now());conversations.update(c);afterCommit(()->{both(c,Map.of("type","CHAT_READ","conversationId",id.toString(),"userId",userId.toString(),"readSeq",seq.toString()));publishUnread(userId);});}return view(c,userId);
    });}
    private ConversationVO view(Conversation c,Long userId){
        var r=c.getRequestId()==null?null:requests.find(c.getRequestId());
        var order=c.getOrderId()==null?null:conversations.order(c.getOrderId());
        boolean buyer=userId.equals(c.getBuyerId());
        Long otherId=buyer?c.getCreatorId():c.getBuyerId();
        var other=users.findById(otherId);
        long seq=buyer?c.getBuyerReadSeq():c.getCreatorReadSeq();
        String disabled=disabled(c);
        // 头像和成交快照仅用于展示；签名失败不阻断会话读取，前端按昵称首字兜底。
        var avatar=other==null?null:avatars.view(other.getId(),other.getAvatarFileId());
        String cover=orderCoverImageId(order);
        String status=orderStatus(order);
        // 进入会话前已校验交易身份。付款入口与订单详情使用相同的买家及有效状态条件。
        boolean canPayOrder=order!=null&&userId.equals(order.getBuyerId())&&"PENDING_PAY".equals(status);
        return new ConversationVO(c.getId().toString(),text(c.getRequestId()),text(c.getOrderId()),
                r==null?null:r.getTitle(),policy.effectiveStatus(r),otherId.toString(),other==null?"已注销用户":other.getNickname(),
                avatar==null?null:avatar.url(),avatar==null?null:avatar.expiresAt(),conversations.unreadIn(c.getId(),userId,seq),
                time(c.getLastMessageAt()),c.getLastMessageSeq().toString(),Long.toString(seq),disabled==null,disabled,
                time(c.getArchivedAt()),c.getArchiveReason(),order==null?null:order.getTitleSnapshot(),status,
                order==null?null:order.getTotalAmount().setScale(2).toPlainString(),cover,canPayOrder);
    }
    /** 现货订单成交主图来自不可变方案快照；定制订单无独立封面，返回 null。 */
    private String orderCoverImageId(TradeOrder order){if(order==null||!"STOCK".equals(order.getOrderType())||order.getAgreementSnapshot()==null)return null;try{var imageIds=json.readValue(order.getAgreementSnapshot(),new TypeReference<Map<String,Object>>(){}).get("mainImageIds");if(imageIds instanceof List<?> list&&!list.isEmpty()&&list.getFirst() instanceof String id)return id;}catch(RuntimeException ignored){}return null;}
    private String orderStatus(TradeOrder order){if(order==null)return null;return "PENDING_PAY".equals(order.getStatus())&&order.getPayDeadlineAt()!=null&&!policy.now().isBefore(order.getPayDeadlineAt())?"CANCELLED":order.getStatus();}
    private String disabled(Conversation c){if(c.getOrderId()!=null)return null;if(c.getArchivedAt()!=null)return "未形成订单的会话已归档，仅可查看历史消息";var r=c.getRequestId()==null?null:requests.find(c.getRequestId());if(r==null)return "会话关联需求不存在";String status=policy.effectiveStatus(r);if(!Set.of("OPEN","QUOTING").contains(status))return "需求已关闭、过期或已定标，未成单会话仅可查看历史";return null;}
    private ChatMessageVO message(ChatMessage m){return new ChatMessageVO(m.getId().toString(),m.getConversationId().toString(),m.getSeqNo().toString(),m.getSenderId().toString(),m.getClientMessageKey(),m.getContent(),ids(m.getImageIds()),time(m.getCreatedAt()),text(m.getReferencedNodeId()),m.getReferencedNodeCode());}
    private void checkImages(Long userId,Long conversationId,List<String> imageIds){if(new HashSet<>(imageIds).size()!=imageIds.size())throw invalid("消息图片不能重复");imageIds.stream().map(this::number).sorted().forEach(id->{var f=files.lockById(id);if(f==null||!userId.equals(f.getUploaderId())||!f.getObjectKey().startsWith("conversations/"+conversationId+"/"+userId+"/")||!"AVAILABLE".equals(f.getUploadStatus()))throw invalid("消息图片须为本人在当前会话上传的图片");});}
    private void participant(Long userId,Conversation c){if(c==null||!userId.equals(c.getBuyerId())&&!userId.equals(c.getCreatorId()))throw missing();}
    private void publishUnread(Long userId){socket.publish(userId,Map.of("type","CHAT_UNREAD_UPDATED","count",conversations.unread(userId)));}
    private void both(Conversation c,Object event){socket.publish(c.getBuyerId(),event);socket.publish(c.getCreatorId(),event);}
    private void afterCommit(Runnable action){TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){public void afterCommit(){try{action.run();}catch(RuntimeException e){LOGGER.error("会话事件推送失败：stage=事务提交后，消息可补拉",SafeLog.exception(e));}}});}
    private List<String> ids(String raw){return raw==null?List.of():json.readValue(raw,new TypeReference<List<String>>(){});}
    private Long number(String value){try{long id=Long.parseLong(value);if(id>0)return id;}catch(NumberFormatException ignored){}throw invalid("图片或节点编号无效");}
    private static String normalize(String s){return s==null||s.isBlank()?null:s.strip();}
    private static String text(Long value){return value==null?null:value.toString();}
    private static OffsetDateTime time(LocalDateTime value){return value==null?null:value.atOffset(ZoneOffset.ofHours(8));}
    private static void page(int page,int size){if(page<1||page>1000000||size<1||size>50)throw invalid("分页参数无效");}
    private static BusinessException invalid(String m){return new BusinessException(CommonErrorCode.INVALID_REQUEST,m);}
    private static BusinessException conflict(String m){return new BusinessException(CommonErrorCode.CONFLICT,m);}
    private static BusinessException forbidden(String m){return new BusinessException(CommonErrorCode.FORBIDDEN,m);}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
}
