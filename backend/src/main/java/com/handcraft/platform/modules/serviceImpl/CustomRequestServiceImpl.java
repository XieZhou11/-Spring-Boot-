package com.handcraft.platform.modules.serviceImpl;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.content.PlainTextPolicy;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.slf4j.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
/** 用户行锁保证同时开放额度，需求行锁串行化状态、会话创建和未来定标。 */
@Service
public class CustomRequestServiceImpl implements CustomRequestService {
    private static final Logger LOGGER=LoggerFactory.getLogger(CustomRequestServiceImpl.class);
    private final CustomRequestMapper requests;private final UserAccountMapper users;private final CategoryMapper categories;private final FileAssetMapper files;private final WorkMapper works;private final ConversationMapper conversations;
    private final CustomRequestPolicyService policy;private final OperationLogService logs;private final NotificationService notifications;private final QuoteLifecycleService lifecycle;private final QuoteService quotes;private final ObjectMapper json;private final TransactionTemplate tx;
    public CustomRequestServiceImpl(CustomRequestMapper requests,UserAccountMapper users,CategoryMapper categories,FileAssetMapper files,WorkMapper works,ConversationMapper conversations,CustomRequestPolicyService policy,OperationLogService logs,NotificationService notifications,QuoteLifecycleService lifecycle,QuoteService quotes,ObjectMapper json,PlatformTransactionManager manager){this.requests=requests;this.users=users;this.categories=categories;this.files=files;this.works=works;this.conversations=conversations;this.policy=policy;this.logs=logs;this.notifications=notifications;this.lifecycle=lifecycle;this.quotes=quotes;this.json=json;tx=new TransactionTemplate(manager);tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Creation create(Long userId,CustomRequestCreateDTO in){return BusinessLog.run(LOGGER,"定制需求草稿创建",userId,()->{
        policy.lockUsers(userId);policy.user(userId);var candidate=new CustomRequest();candidate.setBuyerId(userId);candidate.setCreateRequestKey(in.getRequestKey());candidate.setStatus("DRAFT");candidate.setVersion(0L);apply(candidate,in);return createLocked(userId,candidate,null);
    });}
    private Creation createLocked(Long userId,CustomRequest candidate,Long sourceId){
        var previous=requests.findKey(userId,candidate.getCreateRequestKey());
        if(previous!=null){var raw=requests.creationDetail(previous.getId());var detail=raw==null?null:json.readTree(raw);if(detail==null||!fingerprint(candidate).equals(detail.path("fingerprint").asText())||!Objects.equals(text(sourceId),detail.path("sourceRequestId").isNull()?null:detail.path("sourceRequestId").asText(null)))throw conflict("同一请求键不能创建不同内容或复制其他需求");if(previous.getDeletedAt()!=null)throw conflict("该请求键的草稿已删除，请重新创建");return new Creation(view(previous,userId),false);}
        checkImages(userId,candidate);requests.insert(candidate);var current=requests.find(candidate.getId());record(userId,current,"CREATE",null,sourceId);return new Creation(view(current,userId),true);
    }
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public CustomRequestVO save(Long userId,Long id,CustomRequestSaveDTO in){return BusinessLog.run(LOGGER,"定制需求草稿保存",userId,()->{
        policy.lockUsers(userId);var r=ownLocked(userId,id);version(r,in.getVersion());if(!"DRAFT".equals(r.getStatus()))throw conflict("需求发布后正文和范围已锁定，请关闭后复制新建");apply(r,in);checkImages(userId,r);update(r);record(userId,r,"SAVE","DRAFT",null);return view(requests.find(id),userId);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public CustomRequestVO publish(Long userId,Long id,CustomRequestPublicationDTO in){return BusinessLog.run(LOGGER,"定制需求发布",userId,()->{
        var fields=json.convertValue(in,CustomRequestFieldsDTO.class);var candidate=new CustomRequest();apply(candidate,fields);
        // 先锁定品类并保留新业务校验结果，成功发布的幂等重试不受后来停用影响。
        BusinessException categoryFailure=null;try{policy.lockCategory(candidate.getCategoryId());}catch(BusinessException failure){categoryFailure=failure;}policy.lockUsers(userId,candidate.getInvitedCreatorId());var buyer=policy.user(userId);var r=ownLocked(userId,id);
        if(!"DRAFT".equals(r.getStatus())){if(Set.of("OPEN","QUOTING").contains(r.getStatus())&&Objects.equals(r.getVersion(),in.getVersion()+1)&&fingerprint(r).equals(fingerprint(candidate)))return view(r,userId);throw conflict("需求已发布或关闭，正文和范围不可修改");}
        if(categoryFailure!=null)throw categoryFailure;version(r,in.getVersion());if(buyer.isAdminBusinessPaused())throw forbidden("账号新业务已暂停，不能发布需求");apply(r,fields);validatePublication(userId,r);checkImages(userId,r);
        if(requests.used(userId,policy.now())>=5)throw conflict("同时待响应或报价中的需求最多五条");r.setStatus("OPEN");r.setPublishedAt(policy.now());r.setNoQuoteExpireAt(policy.now().plusDays(7));update(r);record(userId,r,"PUBLISH","DRAFT",null);
        if("DIRECTED".equals(r.getVisibility()))notifications.customRequestChanged(r.getInvitedCreatorId(),id,"REQUEST_INVITED");LOGGER.info("需求发布校验通过，等待事务提交：userId={}, requestId={}, visibility={}",userId,id,r.getVisibility());return view(requests.find(id),userId);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public void delete(Long userId,Long id,Long expected){BusinessLog.run(LOGGER,"定制需求草稿删除",userId,()->{
        policy.lockUsers(userId);policy.user(userId);var r=requests.lock(id);if(r==null||!userId.equals(r.getBuyerId()))throw missing();if(r.getDeletedAt()!=null){if(Objects.equals(r.getVersion(),expected+1))return null;throw conflict("草稿版本已更新");}version(r,expected);if(!"DRAFT".equals(r.getStatus()))throw conflict("仅草稿可以删除");r.setDeletedAt(policy.now());update(r);record(userId,r,"DELETE","DRAFT",null);return null;
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public CustomRequestVO close(Long userId,Long id,Long expected){return BusinessLog.run(LOGGER,"定制需求关闭",userId,()->{
        var initial=requests.find(id);if(initial==null)throw missing();policy.lockUsers(userId,initial.getInvitedCreatorId());var r=ownLocked(userId,id);
        if("CLOSED".equals(r.getStatus())&&Objects.equals(r.getVersion(),expected+1))return view(r,userId);version(r,expected);if(!Set.of("OPEN","QUOTING").contains(policy.effectiveStatus(r)))throw conflict("仅未定标的开放需求可以关闭");terminate(r,"CLOSED",userId);return view(requests.find(id),userId);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Creation copy(Long userId,Long id,String key){return BusinessLog.run(LOGGER,"定制需求复制新建",userId,()->{
        policy.lockUsers(userId);var source=ownLocked(userId,id);if(!Set.of("CLOSED","EXPIRED").contains(policy.effectiveStatus(source)))throw conflict("仅已关闭或过期的需求可复制新建");var copy=new CustomRequest();apply(copy,json.convertValue(snapshot(source),CustomRequestFieldsDTO.class));copy.setBuyerId(userId);copy.setCreateRequestKey(key);copy.setStatus("DRAFT");copy.setVersion(0L);copy.setVisibility("PUBLIC");copy.setInvitedCreatorId(null);copy.setSourceWorkId(null);return createLocked(userId,copy,id);
    });}
    public CustomRequestVO detail(Long userId,Long id,boolean ownOnly){return BusinessLog.run(LOGGER,"定制需求详情查询",userId,()->{var r=requests.find(id);policy.visible(userId,r,ownOnly);return view(r,userId);});}
    public PageVO<CustomRequestVO> list(Long userId,String mode,CustomRequestQueryDTO q){return BusinessLog.run(LOGGER,"定制需求列表查询",userId,()->{
        var user=policy.user(userId);if(!"OWN".equals(mode)&&!"APPROVED".equals(user.getCertificationStatus()))throw forbidden("仅认证创作者可浏览需求大厅和本人邀约");if(q.getMinBudget()!=null&&q.getMaxBudget()!=null&&q.getMinBudget().compareTo(q.getMaxBudget())>0)throw invalid("最低预算不能高于最高预算");if(q.getPublishedAfter()!=null&&q.getPublishedBefore()!=null&&!q.getPublishedAfter().isBefore(q.getPublishedBefore()))throw invalid("发布时间起点须早于终点");
        int size="PUBLIC".equals(mode)?20:q.getSize();var mains=policy.mainCategories(user);if(mains.isEmpty())mains=List.of(0L);var now=policy.now();var after=local(q.getPublishedAfter());var before=local(q.getPublishedBefore());return new PageVO<>(requests.list(userId,mode,q,mains,now,after,before,(q.getPage()-1)*size,size).stream().map(r->view(r,userId)).toList(),requests.count(userId,mode,q,mains,now,after,before),q.getPage(),size);
    });}
    public CustomRequestQuotaVO quota(Long userId){return BusinessLog.run(LOGGER,"定制需求发布额度查询",userId,()->{var u=policy.user(userId);long used=requests.used(userId,policy.now());String reason=u.isAdminBusinessPaused()?"账号新业务已暂停":used>=5?"同时待响应或报价中的需求最多五条":null;return new CustomRequestQuotaVO(used,5,Math.max(0,5-used),reason==null,reason);});}
    /** 每条到期记录独立事务，通知或归档失败整体回滚，下轮继续重试。 */
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    public void expireDue(){try{for(var id:requests.due(policy.now()))try{tx.executeWithoutResult(s->BusinessLog.run(LOGGER,"定制需求过期归档",null,()->{var initial=requests.find(id);if(initial==null)return null;policy.lockUsers(initial.getBuyerId(),initial.getInvitedCreatorId());var r=requests.lock(id);if("EXPIRED".equals(policy.effectiveStatus(r))&&Set.of("OPEN","QUOTING").contains(r.getStatus()))terminate(r,"EXPIRED",null);return null;}));}catch(RuntimeException e){LOGGER.error("定制需求过期失败：stage=单条归档事务, requestId={}",id,SafeLog.exception(e));}}catch(RuntimeException e){LOGGER.error("定制需求过期失败：stage=扫描到期需求",SafeLog.exception(e));}}
    private void terminate(CustomRequest r,String status,Long actor){lifecycle.terminate(r,status,actor);}
    private void validatePublication(Long userId,CustomRequest r){
        // Bean Validation检查原始字段；去除首尾空白后仍须满足实际标题与描述的字数。
        int titleLength=r.getTitle().codePointCount(0,r.getTitle().length()),descriptionLength=r.getDescription().codePointCount(0,r.getDescription().length());if(titleLength<5||titleLength>30)throw invalid("标题应为五至三十字");if(descriptionLength<20||descriptionLength>2000)throw invalid("需求描述应为二十至二千字");
        if(r.getBudgetMin().compareTo(r.getBudgetMax())>0)throw invalid("预算上限不能低于下限");LocalDate today=policy.now().toLocalDate();if(r.getExpectedShipDate().isBefore(today.plusDays(7))||r.getExpectedShipDate().isAfter(today.plusDays(180)))throw invalid("期望发货日须在发布后七至一百八十天之间");
        for(var t:List.of(r.getTitle(),r.getPurpose(),r.getMaterialPreference(),r.getSpecification(),r.getDescription()))if(!PlainTextPolicy.safe(t))throw invalid("需求文本不能包含脚本、联系方式、外链、站外引流或不当内容");
        if("DIRECTED".equals(r.getVisibility())){if(r.getInvitedCreatorId()==null||userId.equals(r.getInvitedCreatorId()))throw invalid("定向需求须选择一名非本人的创作者");String reason=policy.creatorReason(users.findById(r.getInvitedCreatorId()),r.getCategoryId());if(reason!=null)throw forbidden(reason);}else if(r.getInvitedCreatorId()!=null)throw invalid("公开需求不能指定受邀者");
        if(r.getSourceWorkId()!=null){var w=works.lock(r.getSourceWorkId());if(!"DIRECTED".equals(r.getVisibility())||w==null||w.getDeletedAt()!=null||!Objects.equals(w.getCreatorId(),r.getInvitedCreatorId())||!"ONLINE".equals(w.getReviewStatus())||!w.isCustomEnabled())throw invalid("来源作品须为受邀创作者已上架且接受定制的作品");}
    }
    private CustomRequestVO view(CustomRequest r,Long userId){var buyer=users.findById(r.getBuyerId());var invited=r.getInvitedCreatorId()==null?null:users.findById(r.getInvitedCreatorId());var path=new ArrayList<String>();if(r.getCategoryId()!=null){var c=categories.find(r.getCategoryId());if(c!=null){if(c.getParentId()!=null){var p=categories.find(c.getParentId());if(p!=null)path.add(p.getName());}path.add(c.getName());}}String status=policy.effectiveStatus(r);boolean own=userId.equals(r.getBuyerId());boolean draft="DRAFT".equals(status);boolean open=Set.of("OPEN","QUOTING").contains(status);String reason=null;
        Long creator=own?r.getInvitedCreatorId():userId;var existing=creator==null?null:conversations.byRequest(r.getId(),creator);
        if(existing==null){if(!open)reason="需求未开放或已经结束";else if(own&&creator==null)reason="请从消息中心进入已建立的需求会话";else if(!own&&"DIRECTED".equals(r.getVisibility())&&!userId.equals(r.getInvitedCreatorId()))reason="仅指定受邀创作者可咨询";else if(!own&&userId.equals(r.getBuyerId()))reason="不能与自己建立会话";else {var currentBuyer=users.findById(r.getBuyerId());if(currentBuyer.isAdminBusinessPaused())reason="需求买家新业务已暂停";else reason=policy.creatorReason(creator==null?null:users.findById(creator),r.getCategoryId());}}
        String quoteReason=quotes.submissionReason(userId,r.getId());
        return new CustomRequestVO(text(r.getId()),buyer.getNickname(),r.getTitle(),text(r.getCategoryId()),path,r.getPurpose(),r.getMaterialPreference(),r.getSpecification(),money(r.getBudgetMin()),money(r.getBudgetMax()),r.getExpectedShipDate(),ids(r.getReferenceImageIds()),r.getDescription(),r.getVisibility(),text(r.getInvitedCreatorId()),invited==null?null:invited.getNickname(),text(r.getSourceWorkId()),status,text(r.getVersion()),time(r.getPublishedAt()),time(r.getNoQuoteExpireAt()),time(r.getClosedAt()),time(r.getCreatedAt()),time(r.getUpdatedAt()),own,own&&draft,own&&draft&&!buyer.isAdminBusinessPaused()&&requests.used(userId,policy.now())<5,own&&open,own&&Set.of("CLOSED","EXPIRED").contains(status),reason==null,reason,quoteReason==null,quoteReason);
    }
    private void apply(CustomRequest r,CustomRequestFieldsDTO in){r.setTitle(trim(in.getTitle()));r.setCategoryId(number(in.getCategoryId()));r.setPurpose(trim(in.getPurpose()));r.setMaterialPreference(trim(in.getMaterialPreference()));r.setSpecification(trim(in.getSpecification()));r.setBudgetMin(in.getBudgetMin());r.setBudgetMax(in.getBudgetMax());r.setExpectedShipDate(in.getExpectedShipDate());r.setReferenceImageIds(json.writeValueAsString(in.getReferenceImageIds()));r.setDescription(trim(in.getDescription()));r.setVisibility(in.getVisibility());r.setInvitedCreatorId(number(in.getInvitedCreatorId()));r.setSourceWorkId(number(in.getSourceWorkId()));if(r.getBudgetMin()!=null&&r.getBudgetMax()!=null&&r.getBudgetMin().compareTo(r.getBudgetMax())>0)throw invalid("预算上限不能低于下限");if("PUBLIC".equals(r.getVisibility())&&r.getInvitedCreatorId()!=null)throw invalid("公开需求不能指定受邀者");}
    private void checkImages(Long userId,CustomRequest r){var ids=ids(r.getReferenceImageIds());if(new HashSet<>(ids).size()!=ids.size())throw invalid("参考图不能重复");ids.stream().map(CustomRequestServiceImpl::number).sorted().forEach(id->{var f=files.lockById(id);if(f==null||!userId.equals(f.getUploaderId())||!f.getObjectKey().startsWith("custom-requests/"+userId+"/")||!"AVAILABLE".equals(f.getUploadStatus()))throw invalid("参考图须为本人已上传的需求图片");});}
    private CustomRequest ownLocked(Long user,Long id){var r=requests.lock(id);policy.visible(user,r,true);return r;}
    private void version(CustomRequest r,Long expected){if(!Objects.equals(r.getVersion(),expected))throw conflict("需求版本已更新，请刷新后重试");}
    private void update(CustomRequest r){r.setUpdatedAt(policy.now());if(requests.update(r)!=1)throw conflict("需求版本已更新，请刷新后重试");r.setVersion(r.getVersion()+1);}
    private void record(Long actor,CustomRequest r,String action,String before,Long source){var detail=new LinkedHashMap<String,Object>();detail.put("fingerprint",fingerprint(r));detail.put("snapshot",Map.of("referenceImageIds",ids(r.getReferenceImageIds())));detail.put("sourceRequestId",text(source));logs.record(actor,false,"CUSTOM_REQUEST",r.getId(),action,before,r.getStatus(),null,detail);}
    private Map<String,Object> snapshot(CustomRequest r){var m=new LinkedHashMap<String,Object>();m.put("title",r.getTitle());m.put("categoryId",text(r.getCategoryId()));m.put("purpose",r.getPurpose());m.put("materialPreference",r.getMaterialPreference());m.put("specification",r.getSpecification());m.put("budgetMin",money(r.getBudgetMin()));m.put("budgetMax",money(r.getBudgetMax()));m.put("expectedShipDate",r.getExpectedShipDate());m.put("referenceImageIds",ids(r.getReferenceImageIds()));m.put("description",r.getDescription());m.put("visibility",r.getVisibility());m.put("invitedCreatorId",text(r.getInvitedCreatorId()));m.put("sourceWorkId",text(r.getSourceWorkId()));return m;}
    private String fingerprint(CustomRequest r){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsString(snapshot(r)).getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    private List<String> ids(String raw){return raw==null?List.of():json.readValue(raw,new TypeReference<List<String>>(){});}
    private static Long number(String value){if(value==null)return null;try{long n=Long.parseLong(value);if(n>0)return n;}catch(NumberFormatException ignored){}throw invalid("资源编号无效");}
    private static String money(java.math.BigDecimal value){return value==null?null:value.setScale(2).toPlainString();}
    private static String trim(String value){return value==null?null:value.strip();}
    private static String text(Long value){return value==null?null:value.toString();}
    private static OffsetDateTime time(LocalDateTime value){return value==null?null:value.atOffset(ZoneOffset.ofHours(8));}
    private static LocalDateTime local(OffsetDateTime value){return value==null?null:value.atZoneSameInstant(ZoneId.of("Asia/Shanghai")).toLocalDateTime();}
    private static BusinessException invalid(String message){return new BusinessException(CommonErrorCode.INVALID_REQUEST,message);}
    private static BusinessException conflict(String message){return new BusinessException(CommonErrorCode.CONFLICT,message);}
    private static BusinessException forbidden(String message){return new BusinessException(CommonErrorCode.FORBIDDEN,message);}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
}
