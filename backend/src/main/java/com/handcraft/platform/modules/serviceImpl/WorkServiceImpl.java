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
import java.util.function.Supplier;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
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
    private final WorkMapper works; private final UserAccountMapper users; private final CategoryMapper categories;
    private final FileAssetMapper files; private final CreatorApplicationMapper applications;
    private final OperationLogService logs; private final NotificationService notifications;
    private final WorkImageService images; private final AvatarService avatars; private final ObjectMapper json; private final Clock clock;
    private final CreatorReputationService reputations;
    private final TradeOrderMapper tradeOrders;
    private final CustomRequestPolicyService policy;
    public WorkServiceImpl(WorkMapper works,UserAccountMapper users,CategoryMapper categories,FileAssetMapper files,CreatorApplicationMapper applications,OperationLogService logs,NotificationService notifications,WorkImageService images,AvatarService avatars,ObjectMapper json,Clock clock,CreatorReputationService reputations,TradeOrderMapper tradeOrders,CustomRequestPolicyService policy){this.works=works;this.users=users;this.categories=categories;this.files=files;this.applications=applications;this.logs=logs;this.notifications=notifications;this.images=images;this.avatars=avatars;this.json=json;this.clock=clock;this.reputations=reputations;this.tradeOrders=tradeOrders;this.policy=policy;}
    private <T>T run(String name,Long user,Supplier<T> action){return BusinessLog.run(LOGGER,name,user,action);}

    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Creation create(Long userId,WorkCreateDTO input){return run("作品草稿创建",userId,()->{
        lockCategory(input.getCategoryId());qualified(users.lockById(userId),false);
        Work repeated=works.findRequest(userId,input.getRequestKey());
        Work candidate=new Work();candidate.setCreatorId(userId);candidate.setCreateRequestKey(input.getRequestKey());candidate.setVersion(0L);candidate.setReviewStatus("DRAFT");copy(candidate,input);validateSourceOrder(userId,candidate,input.getSourceOrderId(),null);tradingValues(candidate,false,false);
        if(repeated!=null){String detail=works.creationDetail(repeated.getId());if(detail==null||!json.readTree(detail).get("snapshot").equals(json.valueToTree(snapshot(candidate))))throw conflict("同一请求键不能创建不同内容");return new Creation(view(repeated,false),false);}
        checkImages(userId,candidate);works.insert(candidate);Work current=works.find(candidate.getId());
        record(userId,false,current,"CREATE",null,Map.of("snapshot",snapshot(candidate)),null);return new Creation(view(current,false),true);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public WorkVO save(Long userId,Long id,WorkSaveDTO input){return run("作品草稿保存",userId,()->{
        lockCategory(input.getCategoryId());users.lockById(userId);Work w=own(userId,id);version(w,input.getVersion());
        if(!Set.of("DRAFT","REJECTED","OFFLINE").contains(w.getReviewStatus()))throw conflict("请先撤回审核，已上架作品请提交修改内容重新审核");
        var before=snapshot(w);String status=w.getReviewStatus();Long originalSourceOrderId=w.getSourceOrderId();copy(w,input);validateSourceOrder(userId,w,input.getSourceOrderId(),originalSourceOrderId);tradingValues(w,false,w.isSaleEnabled());checkImages(userId,w);
        if(before.equals(snapshot(w)))return view(w,false);update(w);record(userId,false,w,"SAVE",status,changes(before,w),null);return view(works.find(id),false);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public WorkVO submit(Long userId,Long id,WorkSaveDTO input){return run("作品提交审核",userId,()->{
        List<Category> path=lockCategory(input.getCategoryId());qualified(users.lockById(userId),true);Work w=own(userId,id);version(w,input.getVersion());
        if("PENDING".equals(w.getReviewStatus()))throw conflict("作品正在审核，请先撤回后修改");
        var before=snapshot(w);String status=w.getReviewStatus();Long originalSourceOrderId=w.getSourceOrderId();copy(w,input);validateSourceOrder(userId,w,input.getSourceOrderId(),originalSourceOrderId);validatePublication(w,path);tradingValues(w,true,!"ONLINE".equals(status)||!Boolean.TRUE.equals(before.get("saleEnabled")));checkImages(userId,w);
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
    @Override
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public WorkVO restoreStock(Long userId,Long id,StockAvailabilityDTO input){
        return run("恢复现货直购",userId,()->{
            Long originalOrderId=number(input.getOriginalOrderId());
            LOGGER.info("恢复现货直购核验：userId={}, workId={}, originalOrderId={}",userId,id,originalOrderId);
            Work initial=available(works.find(id));
            if(!userId.equals(initial.getCreatorId()))throw missing();
            version(initial,input.getVersion());
            if(!stockRecoveryCandidate(initial)||!originalOrderId.equals(initial.getStockOrderId())){
                throw conflict("作品已售出关联变化或不支持恢复直购，请刷新后重试");
            }
            TradeOrder initialOrder=tradeOrders.find(originalOrderId);
            if(!stockOrderMatches(initial,initialOrder))throw conflict("作品与原售出订单关联不一致");

            // 与现货建单、付款同序，原买家和创作者的账号锁也与退款裁定串行化。
            policy.lockCategory(initial.getCategoryId());
            policy.lockUsers(userId,initialOrder.getBuyerId());
            Work work=own(userId,id);
            version(work,input.getVersion());
            if(!stockRecoveryCandidate(work)||!originalOrderId.equals(work.getStockOrderId())
                    ||!Objects.equals(initial.getCategoryId(),work.getCategoryId())){
                throw conflict("作品或原售出关联已变化，请刷新后重试");
            }
            String creatorReason=policy.creatorReason(users.findById(userId),work.getCategoryId());
            if(creatorReason!=null)throw forbidden(creatorReason);
            TradeOrder originalOrder=tradeOrders.lock(originalOrderId);
            if(!stockOrderMatches(work,originalOrder)||!Objects.equals(initialOrder.getBuyerId(),originalOrder.getBuyerId())
                    ||works.stockRecoveryOrders(List.of(id)).isEmpty()){
                throw conflict("原售出订单须完成全额退款并取消待结算，才能恢复直购");
            }
            String confirmation=stockConfirmation(originalOrder);
            if(!confirmation.equals(input.getConfirmation()))throw conflict("可售确认须与原订单发货记录一致");

            var price=input.getStockPrice().setScale(2);
            var currentTime=now().truncatedTo(ChronoUnit.MILLIS);
            if(works.restoreStock(id,userId,work.getVersion(),originalOrderId,price,currentTime)!=1){
                throw conflict("作品或原售出关联已变化，请刷新后重试");
            }
            String reason="NOT_SHIPPED".equals(confirmation)?"作者确认原成品未发出且仍可售":"作者确认原成品已经退回且仍可售";
            logs.record(userId,false,"WORK",id,"STOCK_RESTORE","ONLINE","ONLINE",reason,Map.of(
                    "originalOrderId",originalOrderId.toString(),"confirmation",confirmation,
                    "stockStatusBefore","SOLD_OUT","stockStatusAfter","AVAILABLE","stockPrice",price.toPlainString(),
                    "occurredAt",currentTime.toString()));
            LOGGER.info("恢复现货直购状态已准备：userId={}, workId={}, originalOrderId={}, stockStatus=AVAILABLE",userId,id,originalOrderId);
            return view(works.find(id),false);
        });
    }

    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public WorkVO offline(Long userId,Long id,WorkVersionDTO input,String reason,boolean admin){
        return offline(userId,id,input,reason,admin,null);
    }
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public WorkVO offline(Long userId,Long id,WorkVersionDTO input,String reason,boolean admin,Long reportId){return run("作品下架",userId,()->{
        Work initial=works.find(id);if(initial==null)throw missing();lockUsers(userId,initial.getCreatorId());if(admin)requireAdmin(userId);
        Work w=admin?available(works.lock(id)):own(userId,id);version(w,input.getVersion());if(!"ONLINE".equals(w.getReviewStatus()))throw conflict("仅已上架作品可以下架");
        if(admin&&(reason==null||reason.isBlank()))throw invalid("管理员下架必须填写原因");w.setReviewStatus("OFFLINE");update(w);
        record(userId,admin,w,admin?"ADMIN_OFFLINE":"OFFLINE","ONLINE",Map.of("snapshot",snapshot(w),"submittedVersion",submittedVersion(w)),reason);
        if(admin)notifications.workChanged(w.getCreatorId(),id,Long.valueOf(submittedVersion(w)),"WORK_OFFLINED","OFFLINE",reason,w.getVersion(),reportId);
        return view(works.find(id),false);
    });}
    @Override
    public boolean canRestoreReportedWork(Long workId,Long expectedOfflineVersion,Long reportOperationId){
        return restorable(works.find(workId),expectedOfflineVersion,reportOperationId);
    }
    @Override
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public void restoreReportedWork(Long adminId,Long workId,Long expectedOfflineVersion,Long reportOperationId,String reason){
        run("举报更正恢复作品",adminId,()->{
            requireAdmin(adminId);
            Work initial=available(works.find(workId));
            lockUsers(adminId,initial.getCreatorId());
            requireAdmin(adminId);
            Work work=available(works.lock(workId));
            if(!restorable(work,expectedOfflineVersion,reportOperationId))throw conflict("作品下架后已发生变化，请由作者重新提交审核");
            work.setReviewStatus("ONLINE");
            update(work);
            record(adminId,true,work,"REPORT_RESTORE","OFFLINE",Map.of("snapshot",snapshot(work),"submittedVersion",submittedVersion(work)),reason);
            return null;
        });
    }
    /** 旧举报按日志顺序定位同一次下架，防止更正历史记录恢复后续另一次下架。 */
    private boolean restorable(Work work,Long expectedOfflineVersion,Long reportOperationId){
        if(work==null||work.getDeletedAt()!=null||!"OFFLINE".equals(work.getReviewStatus())
                ||expectedOfflineVersion!=null&&!expectedOfflineVersion.equals(work.getVersion()))return false;
        WorkOperation last=works.latestOperation(work.getId());
        return last!=null&&"ADMIN_OFFLINE".equals(last.getAction())&&last.getDetail()!=null
                &&(expectedOfflineVersion!=null||reportOperationId!=null&&last.getId()<reportOperationId)
                &&json.valueToTree(snapshot(work)).equals(json.readTree(last.getDetail()).path("snapshot"));
    }
    @Override
    public String reportedWorkTitle(Long workId){
        Work work=works.find(workId);
        if(work==null)return null;
        return work.getDeletedAt()==null&&"ONLINE".equals(work.getReviewStatus())?work.getTitle():works.lastPublishedTitle(workId);
    }
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
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public WorkVO detail(Long userId,Long id,String mode){return run("作品详情查询",userId,()->{
        UserAccount actor=requireUser(userId);
        if("ADMIN".equals(mode)){
            requireAdmin(userId);
            return adminView(available(works.adminWork(id)));
        }
        Work work=available(works.find(id));
        if(("OWN".equals(mode)&&!userId.equals(work.getCreatorId()))||("PUBLIC".equals(mode)&&!"ONLINE".equals(work.getReviewStatus())))throw missing();
        TradeOrder recovery="OWN".equals(mode)?stockRecoveryOrders(List.of(work),actor).get(work.getId()):null;
        return view(work,"PUBLIC".equals(mode),recovery);
    });}
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public PageVO<WorkVO> list(Long userId,String mode,WorkQueryDTO q){return run("作品列表查询",userId,()->{
        UserAccount actor=requireUser(userId);
        if("ADMIN".equals(mode))requireAdmin(userId);
        if(q.getMinPrice()!=null&&q.getMaxPrice()!=null&&q.getMinPrice().compareTo(q.getMaxPrice())>0)throw invalid("最低价格不能高于最高价格");
        if("ADMIN".equals(mode)){
            if(q.getStatus()==null)q.setStatus("PENDING");
            return new PageVO<>(works.adminList(q,(q.getPage()-1)*q.getSize(),q.getSize()).stream().map(this::adminView).toList(),
                    works.adminCount(q),q.getPage(),q.getSize());
        }
        if("OWN".equals(mode)&&q.getStatus()==null)q.setStatus("ALL");
        int size="PUBLIC".equals(mode)?20:q.getSize();
        List<Work> items=works.list(userId,mode,q,(q.getPage()-1)*size,size);
        Map<Long,TradeOrder> recoveries="OWN".equals(mode)?stockRecoveryOrders(items,actor):Map.of();
        return new PageVO<>(items.stream().map(w->view(w,"PUBLIC".equals(mode),recoveries.get(w.getId()))).toList(),
                works.count(userId,mode,q),q.getPage(),size);
    });}
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public PageVO<WorkHistoryVO> history(Long userId,Long id,boolean admin,int page,int size){return run("作品历史查询",userId,()->{
        requireUser(userId);
        if(admin)requireAdmin(userId);
        Work work=works.find(id);
        if(work==null||(admin?work.getDeletedAt()!=null||"DRAFT".equals(work.getReviewStatus()):!userId.equals(work.getCreatorId())))throw missing();
        if(page<1||page>1000000||size<1||size>50)throw invalid("分页参数无效");
        return new PageVO<>(works.history(id,admin,(page-1)*size,size).stream().map(operation->historyView(id,operation,admin)).toList(),
                works.historyCount(id,admin),page,size);
    });}
    /** 管理员比较的是两次提交材料，作者保存而未提交的中间版本只保留在本人历史。 */
    private WorkHistoryVO historyView(Long id,WorkOperation operation,boolean admin){
        Map<String,Object> detail=operation.getDetail()==null?new LinkedHashMap<>():json.readValue(operation.getDetail(),new TypeReference<>(){});
        if(admin&&"SUBMIT".equals(operation.getAction())){
            detail.remove("before");
            detail.remove("after");
            String previous=works.precedingSubmittedSnapshot(id,operation.getId());
            if(previous!=null&&detail.get("snapshot")!=null){
                detail.put("before",json.readValue(previous,new TypeReference<Map<String,Object>>(){}));
                detail.put("after",detail.get("snapshot"));
            }
        }
        return new WorkHistoryVO(operation.getId().toString(),operation.getAction(),operation.getBeforeStatus(),operation.getAfterStatus(),
                operation.getReason(),text(operation.getOperatorId()),operation.getOperatorType(),time(operation.getCreatedAt()),detail);
    }
    public WorkPublicationQuotaVO quota(Long userId){return run("作品发布额度查询",userId,()->{UserAccount u=requireUser(userId);long used=used(userId);String reason=eligibilityReason(u);if(reason==null&&used>=5)reason="今日首次提交作品已达5件";return new WorkPublicationQuotaVO(used,5,Math.max(0,5-used),reason==null,reason);});}
    public CreatorPublicVO creator(Long userId,Long creatorId){return run("创作者公开资料查询",userId,()->{
        requireUser(userId);UserAccount u=users.findById(creatorId);if(u==null||u.isAdmin()||!"APPROVED".equals(u.getCertificationStatus()))throw missing();var a=u.getApprovedApplicationId()==null?null:applications.find(u.getApprovedApplicationId());var avatar=avatars.view(creatorId,u.getAvatarFileId());
        var all=categories.all();List<CategoryVO> main=a==null?List.of():applications.categoryIds(a.getId()).stream().map(categories::find).filter(Objects::nonNull).map(c->new CategoryVO(c.getId().toString(),text(c.getParentId()),c.getName(),c.isEnabled(),c.getSortOrder(),List.of(),c.isEnabled()&&all.stream().noneMatch(x->Objects.equals(x.getParentId(),c.getId())))).toList();
        // 主页与报价对比共用退款、治理状态及历史完成事实的统计口径。
        var reputation=reputations.summary(creatorId);
        return new CreatorPublicVO(creatorId.toString(),u.getNickname(),u.getBio(),avatar==null?null:avatar.url(),avatar==null?null:avatar.expiresAt(),main,a==null?null:a.getProvince(),a==null?null:a.getCity(),u.isCreatorPaused()||u.isAdminBusinessPaused(),reputation.averageRating(),reputation.reviewCount(),reputation.positiveRate(),reputation.completedOrderCount(),works.publicCount(creatorId));
    });}
    public PageVO<CreatorPublicVO> customCandidates(Long userId,Long categoryId,String keyword,int page,int size){return run("定向需求创作者选择",userId,()->{
        var current=requireUser(userId);if(current.isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN,"管理员不能作为交易主体");if(page<1||page>1000000||size<1||size>50||keyword!=null&&keyword.length()>30)throw invalid("筛选参数无效");
        var c=categories.find(categoryId);if(c==null||!c.isEnabled()||categories.all().stream().anyMatch(x->Objects.equals(x.getParentId(),categoryId)))throw invalid("请选择启用的末级品类");Long root=c.getParentId()==null?c.getId():c.getParentId();var parent=categories.find(root);if(parent==null||!parent.isEnabled())throw invalid("品类已停用");String query=keyword==null||keyword.isBlank()?null:keyword.strip();
        return new PageVO<>(users.customCandidates(userId,root,query,(page-1)*size,size).stream().map(u->creator(userId,u.getId())).toList(),users.customCandidateCount(userId,root,query),page,size);
    });}
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public List<PublicationOrderOptionVO> approvedPublicationOrders(Long userId){return run("授权成品案例订单列表",userId,()->{
        qualified(requireUser(userId),false);
        return tradeOrders.approvedPublicationOrders(userId).stream()
                .map(o->new PublicationOrderOptionVO(text(o.getId()),o.getTitleSnapshot(),time(o.getOriginalCompletedAt()),time(o.getPublicationRespondedAt()))).toList();
    });}
    /** 驳回、下架状态下当前行仍可编辑，后台用已提交或已公开的材料构建视图。 */
    private WorkVO adminView(Work work){
        if(Set.of("REJECTED","OFFLINE").contains(work.getReviewStatus())){
            WorkFieldsDTO material=work.getAdminSnapshot()==null?new WorkFieldsDTO():json.readValue(work.getAdminSnapshot(),WorkFieldsDTO.class);
            copy(work,material);
        }
        work.setUpdatedAt(work.getAdminUpdatedAt());
        return view(work,false);
    }
    /** 本人列表一次查询可恢复的订单，公开及后台作品视图不读取此摘要。 */
    private Map<Long,TradeOrder> stockRecoveryOrders(List<Work> worksOnPage,UserAccount owner){
        if(eligibilityReason(owner)!=null)return Map.of();
        var candidates=worksOnPage.stream().filter(this::stockRecoveryCandidate).toList();
        if(candidates.isEmpty())return Map.of();
        Set<Long> parentIds=categories.all().stream().map(Category::getParentId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        var workIds=candidates.stream().filter(work->!parentIds.contains(work.getCategoryId()))
                .filter(work->policy.creatorReason(owner,work.getCategoryId())==null).map(Work::getId).toList();
        if(workIds.isEmpty())return Map.of();
        return works.stockRecoveryOrders(workIds).stream().collect(Collectors.toMap(TradeOrder::getWorkId,order->order));
    }

    private boolean stockRecoveryCandidate(Work work){
        return "ONLINE".equals(work.getReviewStatus())&&"SOLD_OUT".equals(work.getStockStatus())
                &&work.getSourceOrderId()==null&&work.getStockOrderId()!=null&&work.getCategoryId()!=null;
    }

    private boolean stockOrderMatches(Work work,TradeOrder order){
        return order!=null&&"STOCK".equals(order.getOrderType())&&work.getId().equals(order.getWorkId())
                &&work.getCreatorId().equals(order.getCreatorId());
    }

    private String stockConfirmation(TradeOrder order){
        return order.getShippedAt()==null?"NOT_SHIPPED":"RETURNED";
    }

    private WorkVO view(Work work,boolean publicView){return view(work,publicView,null);}
    private WorkVO view(Work w,boolean publicView,TradeOrder recoveryOrder){var u=users.findById(w.getCreatorId());var avatar=avatars.view(w.getCreatorId(),u.getAvatarFileId());List<String> main=ids(w.getMainImageIds());List<String> spec=ids(w.getSpecificationImageIds());var category=w.getCategoryId()==null?null:categories.find(w.getCategoryId());var path=new ArrayList<String>();if(category!=null){if(category.getParentId()!=null){var parent=categories.find(category.getParentId());if(parent!=null)path.add(parent.getName());}path.add(category.getName());}
        boolean eligible=eligibilityReason(u)==null&&"ONLINE".equals(w.getReviewStatus());ImageVO cover=main.isEmpty()?null:images.view(w.getCreatorId(),Long.valueOf(main.getFirst()));
        StockRecoveryVO recovery=recoveryOrder==null?null:new StockRecoveryVO(text(recoveryOrder.getId()),
                recoveryOrder.getOrderNo(),stockConfirmation(recoveryOrder));
        return new WorkVO(w.getId().toString(),w.getCreatorId().toString(),u.getNickname(),avatar==null?null:avatar.url(),avatar==null?null:avatar.expiresAt(),text(w.getCategoryId()),path,w.getTitle(),main,spec,w.getMaterial(),w.getSpecification(),w.getDescription(),w.getProcessDescription(),w.isSaleEnabled(),w.isCustomEnabled(),w.getStockPrice()==null?null:w.getStockPrice().setScale(2).toPlainString(),w.getCustomReferenceDays(),w.getReviewStatus(),w.getStockStatus(),w.getVersion().toString(),time(w.getFirstSubmittedAt()),time(w.getSubmittedAt()),time(w.getOnlineAt()),time(w.getCreatedAt()),time(w.getUpdatedAt()),publicView?null:works.reviewReason(w.getId()),eligible&&w.isSaleEnabled()&&"AVAILABLE".equals(w.getStockStatus())&&w.getSourceOrderId()==null,eligible&&w.isCustomEnabled(),cover,text(w.getSourceOrderId()),recovery);
    }
    private void copy(Work w,WorkFieldsDTO in){w.setCategoryId(in.getCategoryId()==null?null:number(in.getCategoryId()));w.setTitle(trim(in.getTitle()));w.setMainImageIds(json.writeValueAsString(in.getMainImageIds()));w.setSpecificationImageIds(json.writeValueAsString(in.getSpecificationImageIds()));w.setMaterial(trim(in.getMaterial()));w.setSpecification(trim(in.getSpecification()));w.setDescription(trim(in.getDescription()));w.setProcessDescription(trim(in.getProcessDescription()));w.setSaleEnabled(Boolean.TRUE.equals(in.getSaleEnabled()));w.setCustomEnabled(Boolean.TRUE.equals(in.getCustomEnabled()));w.setStockPrice(in.getStockPrice());w.setCustomReferenceDays(in.getCustomReferenceDays());w.setSourceOrderId(in.getSourceOrderId()==null?null:number(in.getSourceOrderId()));}
    /** 案例来源只能在创建作品时选择一次，之后不可清除或换绑；授权依据始终从锁定订单读取。 */
    private void validateSourceOrder(Long creatorId,Work work,String requestedSourceOrderId,Long originalSourceOrderId){
        Long requested=requestedSourceOrderId==null?null:number(requestedSourceOrderId);
        if(originalSourceOrderId!=null&&!Objects.equals(originalSourceOrderId,requested))throw conflict("成品案例来源订单不可修改或解除关联");
        if(requested==null){work.setSourceOrderId(null);return;}
        TradeOrder order=tradeOrders.lock(requested);
        if(order==null||!creatorId.equals(order.getCreatorId())||!"CUSTOM".equals(order.getOrderType())||!"APPROVED".equals(order.getPublicationConsentStatus()))throw forbidden("仅可关联本人买家已明确同意公开的定制订单");
        work.setSourceOrderId(requested);work.setSaleEnabled(false);work.setStockPrice(null);
    }
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
        for(String text:List.of(Objects.toString(w.getTitle(),""),Objects.toString(w.getDescription(),""),Objects.toString(w.getMaterial(),""),Objects.toString(w.getSpecification(),""),Objects.toString(w.getProcessDescription(),"")))if(!com.handcraft.platform.common.content.PlainTextPolicy.safe(text))throw invalid("公开文本不能包含脚本、联系方式、外链、站外引流或不当内容");
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
    private Map<String,Object> snapshot(Work w){Map<String,Object> m=new LinkedHashMap<>();m.put("title",w.getTitle());m.put("categoryId",text(w.getCategoryId()));m.put("mainImageIds",ids(w.getMainImageIds()));m.put("specificationImageIds",ids(w.getSpecificationImageIds()));m.put("material",w.getMaterial());m.put("specification",w.getSpecification());m.put("description",w.getDescription());m.put("processDescription",w.getProcessDescription());m.put("saleEnabled",w.isSaleEnabled());m.put("customEnabled",w.isCustomEnabled());m.put("stockPrice",w.getStockPrice()==null?null:w.getStockPrice().setScale(2).toPlainString());m.put("customReferenceDays",w.getCustomReferenceDays());m.put("sourceOrderId",text(w.getSourceOrderId()));return m;}
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
    private static BusinessException forbidden(String reason){return new BusinessException(CommonErrorCode.FORBIDDEN,reason);}
    private static BusinessException conflict(String reason){return new BusinessException(CommonErrorCode.CONFLICT,reason);}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
}
