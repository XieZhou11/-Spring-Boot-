package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.*;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** 作者行锁串行化额度、状态与图片引用；内容快照和通知共用当前事务。 */
@Service
public class WorkServiceImpl implements WorkService {
    private static final Logger LOGGER=LoggerFactory.getLogger(WorkServiceImpl.class);
    private static final ZoneId BEIJING=ZoneId.of("Asia/Shanghai");
    // 普通公开文案按保守规则阻止脚本、联系方式、外链及明显引流，人工审核处理图片及原创性。
    private static final Pattern UNSAFE=Pattern.compile("(?is)<\\s*(script|iframe|object|embed|svg)|javascript\\s*:|on(?:error|load|click)\\s*=|https?://|www\\.|[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}|(?<![0-9])1[3-9][0-9]{9}(?![0-9])|微信|薇信|微\\s*信|加\\s*[vV]|[qQ]{2}|[vV][xX]|联系方式|淘宝|天猫|拼多多|闲鱼|抖音|小红书|京东|傻逼|操你|去死|\\b(?:[a-z0-9-]+\\.)+(?:com|cn|net|org)\\b");
    private final WorkMapper works; private final UserAccountMapper users; private final CategoryMapper categories;
    private final FileAssetMapper files; private final CreatorApplicationMapper applications;
    private final OperationLogService logs; private final NotificationService notifications;
    private final WorkImageService images; private final AvatarService avatars; private final ObjectMapper json; private final Clock clock;
    public WorkServiceImpl(WorkMapper works,UserAccountMapper users,CategoryMapper categories,FileAssetMapper files,CreatorApplicationMapper applications,OperationLogService logs,NotificationService notifications,WorkImageService images,AvatarService avatars,ObjectMapper json,Clock clock){this.works=works;this.users=users;this.categories=categories;this.files=files;this.applications=applications;this.logs=logs;this.notifications=notifications;this.images=images;this.avatars=avatars;this.json=json;this.clock=clock;}
    private <T>T run(String name,Long user,Supplier<T> action){return BusinessLog.run(LOGGER,name,user,action);}

    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Creation create(Long userId,WorkCreateDTO input){return run("作品草稿创建",userId,()->{
        lockCategory(input.getCategoryId());qualified(users.lockById(userId),false);
        Work repeated=works.findRequest(userId,input.getRequestKey());
        Work candidate=new Work();candidate.setCreatorId(userId);candidate.setCreateRequestKey(input.getRequestKey());candidate.setVersion(0L);candidate.setReviewStatus("DRAFT");copy(candidate,input);tradingValues(candidate,false,false);
        if(repeated!=null){String detail=works.creationDetail(repeated.getId());if(detail==null||!json.readTree(detail).get("snapshot").equals(json.valueToTree(snapshot(candidate))))throw conflict("同一请求键不能创建不同内容");return new Creation(view(repeated,false),false);}
        checkImages(userId,candidate);works.insert(candidate);Work current=works.find(candidate.getId());
        record(userId,false,current,"CREATE",null,Map.of("snapshot",snapshot(candidate)),null);return new Creation(view(current,false),true);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public WorkVO save(Long userId,Long id,WorkSaveDTO input){return run("作品草稿保存",userId,()->{
        lockCategory(input.getCategoryId());users.lockById(userId);Work w=own(userId,id);version(w,input.getVersion());
        if(!Set.of("DRAFT","REJECTED","OFFLINE").contains(w.getReviewStatus()))throw conflict("请先撤回审核，已上架作品请提交修改内容重新审核");
        var before=snapshot(w);String status=w.getReviewStatus();copy(w,input);tradingValues(w,false,w.isSaleEnabled());checkImages(userId,w);
        if(before.equals(snapshot(w)))return view(w,false);update(w);record(userId,false,w,"SAVE",status,changes(before,w),null);return view(works.find(id),false);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public WorkVO submit(Long userId,Long id,WorkSaveDTO input){return run("作品提交审核",userId,()->{
        List<Category> path=lockCategory(input.getCategoryId());qualified(users.lockById(userId),true);Work w=own(userId,id);version(w,input.getVersion());
        if("PENDING".equals(w.getReviewStatus()))throw conflict("作品正在审核，请先撤回后修改");
        var before=snapshot(w);String status=w.getReviewStatus();copy(w,input);validatePublication(w,path);tradingValues(w,true,!"ONLINE".equals(status)||!Boolean.TRUE.equals(before.get("saleEnabled")));checkImages(userId,w);
        // 正文相同的在线请求只更新交易设置，不能凭重复提交产生新审核轮次。
        if("ONLINE".equals(status)&&sameContent(before,snapshot(w))){if(before.equals(snapshot(w)))return view(w,false);update(w);record(userId,false,w,"TRADING_SETTINGS",status,changes(before,w),null);return view(works.find(id),false);}
        if(w.getFirstSubmittedAt()==null){if(used(userId)>=5)throw conflict("今日首次提交作品已达5件，请明日再试");w.setFirstSubmittedAt(now());}
        w.setSubmittedAt(now());w.setReviewStatus("PENDING");update(w);
        var detail=changes(before,w);detail.put("snapshot",snapshot(w));detail.put("submittedVersion",w.getVersion().toString());
        record(userId,false,w,"SUBMIT",status,detail,null);return view(works.find(id),false);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public WorkVO withdraw(Long userId,Long id,WorkVersionDTO input){return run("作品审核撤回",userId,()->{
        users.lockById(userId);Work w=own(userId,id);version(w,input.getVersion());if(!"PENDING".equals(w.getReviewStatus()))throw conflict("仅待审核作品可以撤回");
        w.setReviewStatus("DRAFT");update(w);record(userId,false,w,"WITHDRAW","PENDING",Map.of("snapshot",snapshot(w),"submittedVersion",submittedVersion(w)),null);return view(works.find(id),false);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public void delete(Long userId,Long id,Long version){run("作品草稿删除",userId,()->{
        users.lockById(userId);Work w=own(userId,id);version(w,version);if(!"DRAFT".equals(w.getReviewStatus()))throw conflict("只能删除草稿，请先撤回");
        w.setDeletedAt(now());update(w);record(userId,false,w,"DELETE","DRAFT",Map.of("snapshot",snapshot(w)),null);return null;
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public WorkVO trading(Long userId,Long id,WorkTradingDTO input){return run("作品交易设置更新",userId,()->{
        UserAccount user=users.lockById(userId);Work w=own(userId,id);version(w,input.getVersion());if(!"ONLINE".equals(w.getReviewStatus()))throw conflict("仅已上架作品可即时设置交易信息");
        var before=snapshot(w);if((input.getSaleEnabled()&&!w.isSaleEnabled())||(input.getCustomEnabled()&&!w.isCustomEnabled()))qualified(user,true);
        w.setSaleEnabled(input.getSaleEnabled());w.setCustomEnabled(input.getCustomEnabled());w.setStockPrice(input.getStockPrice());w.setCustomReferenceDays(input.getCustomReferenceDays());tradingValues(w,true,!Boolean.TRUE.equals(before.get("saleEnabled"))&&w.isSaleEnabled());
        if(before.equals(snapshot(w)))return view(w,false);update(w);record(userId,false,w,"TRADING_SETTINGS","ONLINE",changes(before,w),null);return view(works.find(id),false);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public WorkVO offline(Long userId,Long id,WorkVersionDTO input,String reason,boolean admin){return run("作品下架",userId,()->{
        Work initial=works.find(id);if(initial==null)throw missing();lockUsers(userId,initial.getCreatorId());if(admin)requireAdmin(userId);
        Work w=admin?available(works.lock(id)):own(userId,id);version(w,input.getVersion());if(!"ONLINE".equals(w.getReviewStatus()))throw conflict("仅已上架作品可以下架");
        if(admin&&(reason==null||reason.isBlank()))throw invalid("管理员下架必须填写原因");w.setReviewStatus("OFFLINE");update(w);
        record(userId,admin,w,admin?"ADMIN_OFFLINE":"OFFLINE","ONLINE",Map.of("snapshot",snapshot(w),"submittedVersion",submittedVersion(w)),reason);
        if(admin)notifications.workChanged(w.getCreatorId(),id,Long.valueOf(submittedVersion(w)),"WORK_OFFLINED","OFFLINE",reason);return view(works.find(id),false);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public WorkVO review(Long userId,Long id,WorkReviewDTO input){return run("作品审核",userId,()->{
        requireAdmin(userId);Work initial=available(works.find(id));lockUsers(userId,initial.getCreatorId());requireAdmin(userId);Work w=available(works.lock(id));
        String reason=input.getReason().strip();if("REJECTED".equals(input.getDecision())&&reason.isBlank())throw invalid("驳回必须填写具体原因");
        if(!"PENDING".equals(w.getReviewStatus())){
            String last=works.reviewDetail(id);if(last!=null&&w.getVersion()==input.getVersion()+1){var d=json.readTree(last);if(input.getVersion().toString().equals(d.get("submittedVersion").asText())&&input.getDecision().equals(d.get("decision").asText())&&reason.equals(d.get("reason").asText()))return view(w,false);}throw conflict("作品已审核、撤回或修改，请刷新后重试");
        }
        version(w,input.getVersion());String submitted=submittedVersion(w);if(!submitted.equals(input.getVersion().toString()))throw conflict("提交版本已变化");
        w.setReviewStatus("APPROVED".equals(input.getDecision())?"ONLINE":"REJECTED");if("ONLINE".equals(w.getReviewStatus()))w.setOnlineAt(now());update(w);
        record(userId,true,w,"REVIEW","PENDING",Map.of("snapshot",snapshot(w),"submittedVersion",submitted,"decision",input.getDecision(),"reason",reason),reason);
        notifications.workChanged(w.getCreatorId(),id,Long.valueOf(submitted),"WORK_REVIEWED",input.getDecision(),reason);return view(works.find(id),false);
    });}
    public WorkVO detail(Long userId,Long id,String mode){return run("作品详情查询",userId,()->{requireUser(userId);if("ADMIN".equals(mode))requireAdmin(userId);Work w=available(works.find(id));if("OWN".equals(mode)&&!userId.equals(w.getCreatorId()))throw missing();if("PUBLIC".equals(mode)&&!"ONLINE".equals(w.getReviewStatus()))throw missing();return view(w,"PUBLIC".equals(mode));});}
    public PageVO<WorkVO> list(Long userId,String mode,WorkQueryDTO q){return run("作品列表查询",userId,()->{
        requireUser(userId);if("ADMIN".equals(mode)){requireAdmin(userId);if(q.getStatus()==null)q.setStatus("PENDING");}else if("OWN".equals(mode)&&q.getStatus()==null)q.setStatus("ALL");
        if(q.getMinPrice()!=null&&q.getMaxPrice()!=null&&q.getMinPrice().compareTo(q.getMaxPrice())>0)throw invalid("最低价格不能高于最高价格");
        int size="PUBLIC".equals(mode)?20:q.getSize();return new PageVO<>(works.list(userId,mode,q,(q.getPage()-1)*size,size).stream().map(w->view(w,"PUBLIC".equals(mode))).toList(),works.count(userId,mode,q),q.getPage(),size);
    });}
    public PageVO<WorkHistoryVO> history(Long userId,Long id,boolean admin,int page,int size){return run("作品历史查询",userId,()->{
        requireUser(userId);if(admin)requireAdmin(userId);Work w=works.find(id);if(w==null||(!admin&&!userId.equals(w.getCreatorId())))throw missing();if(page<1||page>1000000||size<1||size>50)throw invalid("分页参数无效");
        return new PageVO<>(works.history(id,(page-1)*size,size).stream().map(x->new WorkHistoryVO(x.getId().toString(),x.getAction(),x.getBeforeStatus(),x.getAfterStatus(),x.getReason(),text(x.getOperatorId()),x.getOperatorType(),time(x.getCreatedAt()),json.readValue(x.getDetail(),new TypeReference<Map<String,Object>>(){}))).toList(),works.historyCount(id),page,size);
    });}
    public WorkPublicationQuotaVO quota(Long userId){return run("作品发布额度查询",userId,()->{UserAccount u=requireUser(userId);long used=used(userId);String reason=eligibilityReason(u);if(reason==null&&used>=5)reason="今日首次提交作品已达5件";return new WorkPublicationQuotaVO(used,5,Math.max(0,5-used),reason==null,reason);});}
    public CreatorPublicVO creator(Long userId,Long creatorId){return run("创作者公开资料查询",userId,()->{
        requireUser(userId);UserAccount u=users.findById(creatorId);if(u==null||u.isAdmin()||!"APPROVED".equals(u.getCertificationStatus()))throw missing();var a=u.getApprovedApplicationId()==null?null:applications.find(u.getApprovedApplicationId());var avatar=avatars.view(creatorId,u.getAvatarFileId());
        var all=categories.all();List<CategoryVO> main=a==null?List.of():applications.categoryIds(a.getId()).stream().map(categories::find).filter(Objects::nonNull).map(c->new CategoryVO(c.getId().toString(),text(c.getParentId()),c.getName(),c.isEnabled(),c.getSortOrder(),List.of(),c.isEnabled()&&all.stream().noneMatch(x->Objects.equals(x.getParentId(),c.getId())))).toList();
        return new CreatorPublicVO(creatorId.toString(),u.getNickname(),u.getBio(),avatar==null?null:avatar.url(),avatar==null?null:avatar.expiresAt(),main,a==null?null:a.getProvince(),a==null?null:a.getCity(),u.isCreatorPaused()||u.isAdminBusinessPaused(),works.averageRating(creatorId),works.reviewCount(creatorId),works.completedCount(creatorId),works.publicCount(creatorId));
    });}
    private WorkVO view(Work w,boolean publicView){var u=users.findById(w.getCreatorId());var avatar=avatars.view(w.getCreatorId(),u.getAvatarFileId());List<String> main=ids(w.getMainImageIds());List<String> spec=ids(w.getSpecificationImageIds());var category=w.getCategoryId()==null?null:categories.find(w.getCategoryId());var path=new ArrayList<String>();if(category!=null){if(category.getParentId()!=null){var parent=categories.find(category.getParentId());if(parent!=null)path.add(parent.getName());}path.add(category.getName());}
        boolean eligible=eligibilityReason(u)==null&&"ONLINE".equals(w.getReviewStatus());ImageVO cover=main.isEmpty()?null:images.view(w.getCreatorId(),Long.valueOf(main.getFirst()));
        return new WorkVO(w.getId().toString(),w.getCreatorId().toString(),u.getNickname(),avatar==null?null:avatar.url(),avatar==null?null:avatar.expiresAt(),text(w.getCategoryId()),path,w.getTitle(),main,spec,w.getMaterial(),w.getSpecification(),w.getDescription(),w.getProcessDescription(),w.isSaleEnabled(),w.isCustomEnabled(),w.getStockPrice()==null?null:w.getStockPrice().setScale(2).toPlainString(),w.getCustomReferenceDays(),w.getReviewStatus(),w.getStockStatus(),w.getVersion().toString(),time(w.getFirstSubmittedAt()),time(w.getSubmittedAt()),time(w.getOnlineAt()),time(w.getCreatedAt()),time(w.getUpdatedAt()),publicView?null:works.reviewReason(w.getId()),eligible&&w.isSaleEnabled()&&"AVAILABLE".equals(w.getStockStatus())&&w.getSourceOrderId()==null,eligible&&w.isCustomEnabled(),cover);
    }
    private void copy(Work w,WorkFieldsDTO in){w.setCategoryId(in.getCategoryId()==null?null:number(in.getCategoryId()));w.setTitle(trim(in.getTitle()));w.setMainImageIds(json.writeValueAsString(in.getMainImageIds()));w.setSpecificationImageIds(json.writeValueAsString(in.getSpecificationImageIds()));w.setMaterial(trim(in.getMaterial()));w.setSpecification(trim(in.getSpecification()));w.setDescription(trim(in.getDescription()));w.setProcessDescription(trim(in.getProcessDescription()));w.setSaleEnabled(Boolean.TRUE.equals(in.getSaleEnabled()));w.setCustomEnabled(Boolean.TRUE.equals(in.getCustomEnabled()));w.setStockPrice(in.getStockPrice());w.setCustomReferenceDays(in.getCustomReferenceDays());}
    private void tradingValues(Work w,boolean complete,boolean opening){
        if(complete&&w.isSaleEnabled()&&w.getStockPrice()==null)throw invalid("出售现货必须填写售价");if(complete&&w.isCustomEnabled()&&w.getCustomReferenceDays()==null)throw invalid("接受定制必须填写参考周期");
        // 草稿保存也要阻止重新打开已锁定/已售出入口；授权成品案例始终禁止出售现货。
        if(w.isSaleEnabled()&&(w.getSourceOrderId()!=null||(opening&&Set.of("RESERVED","SOLD_OUT").contains(Objects.toString(w.getStockStatus(),"")))))throw conflict("锁定、已售出或授权成品案例不能开启直购");
        if(w.isSaleEnabled()&&w.getStockStatus()==null)w.setStockStatus("AVAILABLE");
        if(!w.isSaleEnabled())w.setStockPrice(null);if(!w.isCustomEnabled())w.setCustomReferenceDays(null);
    }
    private List<Category> lockCategory(String id){if(id==null)return List.of();Category initial=categories.find(number(id));if(initial==null)throw invalid("品类不存在");List<Category> path=new ArrayList<>();if(initial.getParentId()!=null)path.add(categories.share(initial.getParentId()));path.add(categories.share(initial.getId()));return path;}
    private void validatePublication(Work w,List<Category> path){
        if(w.getCategoryId()==null||path.isEmpty()||path.stream().anyMatch(c->c==null||!c.isEnabled()))throw invalid("请选择启用的末级品类");
        if(categories.all().stream().anyMatch(c->Objects.equals(c.getParentId(),w.getCategoryId())))throw invalid("该一级品类有二级，请选择最具体的品类");
        length(w.getTitle(),2,30,"作品标题");if(w.getTitle().codePoints().noneMatch(Character::isLetterOrDigit)||Pattern.compile("(.{1,10})\\1{2,}").matcher(w.getTitle()).find())throw invalid("标题不能为纯符号或重复堆词");
        length(w.getMaterial(),1,20,"材质");length(w.getSpecification(),1,10000,"尺寸规格");length(w.getDescription(),20,2000,"作品描述");length(w.getProcessDescription(),0,1000,"制作过程");
        if(ids(w.getMainImageIds()).isEmpty())throw invalid("至少上传1张作品主图");
        for(String text:List.of(Objects.toString(w.getTitle(),""),Objects.toString(w.getDescription(),""),Objects.toString(w.getMaterial(),""),Objects.toString(w.getSpecification(),""),Objects.toString(w.getProcessDescription(),"")))if(UNSAFE.matcher(text).find())throw invalid("公开文本不能包含脚本、联系方式、外链、站外引流或不当内容");
    }
    private void checkImages(Long id,Work w){var list=new ArrayList<String>();list.addAll(ids(w.getMainImageIds()));list.addAll(ids(w.getSpecificationImageIds()));if(new HashSet<>(list).size()!=list.size())throw invalid("同一作品图片不能重复");for(Long fid:list.stream().map(this::number).sorted().toList()){var f=files.lockById(fid);if(f==null||!id.equals(f.getUploaderId())||!"AVAILABLE".equals(f.getUploadStatus())||!f.getObjectKey().startsWith("works/"+id+"/"))throw invalid("作品图片不可用或不属于本人");}}
    private void lockUsers(Long actor,Long author){new TreeSet<>(List.of(actor,author)).forEach(users::lockById);}
    private Work own(Long user,Long id){Work w=available(works.lock(id));if(!user.equals(w.getCreatorId()))throw missing();return w;}
    private Work available(Work w){if(w==null||w.getDeletedAt()!=null)throw missing();return w;}
    private UserAccount requireUser(Long id){var u=users.findById(id);if(u==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);return u;}
    private void requireAdmin(Long id){if(!requireUser(id).isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN);}
    private void qualified(UserAccount u,boolean publishing){if(u==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);if(u.isAdmin()||!"APPROVED".equals(u.getCertificationStatus()))throw new BusinessException(CommonErrorCode.FORBIDDEN,"仅认证创作者可以管理作品");if(publishing&&(u.isCreatorPaused()||u.isAdminBusinessPaused()))throw new BusinessException(CommonErrorCode.FORBIDDEN,"当前已暂停新业务，不能提交作品或开启交易");}
    private String eligibilityReason(UserAccount u){if(u==null||u.isAdmin()||!"APPROVED".equals(u.getCertificationStatus()))return "需先完成创作者认证";if(u.isAdminBusinessPaused())return "账号新业务已暂停";if(u.isCreatorPaused())return "创作者已暂停接单";return null;}
    private long used(Long id){LocalDate today=LocalDate.now(clock.withZone(BEIJING));return works.countSubmitted(id,today.atStartOfDay(),today.plusDays(1).atStartOfDay());}
    private LocalDateTime now(){return LocalDateTime.ofInstant(clock.instant(),BEIJING);}
    private void version(Work w,Long version){if(!Objects.equals(w.getVersion(),version))throw conflict("作品版本已更新，请刷新后重试");}
    private void update(Work w){if(works.update(w)!=1)throw conflict("作品版本已更新，请刷新后重试");w.setVersion(w.getVersion()+1);}
    private Map<String,Object> snapshot(Work w){Map<String,Object> m=new LinkedHashMap<>();m.put("title",w.getTitle());m.put("categoryId",text(w.getCategoryId()));m.put("mainImageIds",ids(w.getMainImageIds()));m.put("specificationImageIds",ids(w.getSpecificationImageIds()));m.put("material",w.getMaterial());m.put("specification",w.getSpecification());m.put("description",w.getDescription());m.put("processDescription",w.getProcessDescription());m.put("saleEnabled",w.isSaleEnabled());m.put("customEnabled",w.isCustomEnabled());m.put("stockPrice",w.getStockPrice()==null?null:w.getStockPrice().setScale(2).toPlainString());m.put("customReferenceDays",w.getCustomReferenceDays());return m;}
    private Map<String,Object> changes(Map<String,Object> before,Work w){Map<String,Object>d=new LinkedHashMap<>();d.put("before",before);d.put("after",snapshot(w));return d;}
    private boolean sameContent(Map<String,Object>a,Map<String,Object>b){for(String key:List.of("title","categoryId","mainImageIds","specificationImageIds","material","specification","description","processDescription"))if(!Objects.equals(a.get(key),b.get(key)))return false;return true;}
    private void record(Long actor,boolean admin,Work w,String action,String before,Map<String,Object> detail,String reason){logs.record(actor,admin,"WORK",w.getId(),action,before,w.getReviewStatus(),reason,detail);}
    private String submittedVersion(Work w){String last=works.submissionDetail(w.getId());if(last==null)throw conflict("缺少提交快照，请联系管理员");return json.readTree(last).get("submittedVersion").asText();}
    private List<String> ids(String value){return value==null?List.of():json.readValue(value,new TypeReference<List<String>>(){});}
    private void length(String s,int min,int max,String name){int count=s==null?0:s.codePointCount(0,s.length());if(count<min||count>max)throw invalid(name+"应为"+min+"—"+max+"字");}
    private Long number(String s){try{long id=Long.parseLong(s);if(id>0)return id;}catch(NumberFormatException ignored){}throw invalid("资源编号无效");}
    private static String trim(String s){return s==null?null:s.strip();}
    private static String text(Long id){return id==null?null:id.toString();}
    private static OffsetDateTime time(LocalDateTime t){return t==null?null:t.atZone(BEIJING).toOffsetDateTime();}
    private static BusinessException invalid(String reason){return new BusinessException(CommonErrorCode.INVALID_REQUEST,reason);}
    private static BusinessException conflict(String reason){return new BusinessException(CommonErrorCode.CONFLICT,reason);}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
}
