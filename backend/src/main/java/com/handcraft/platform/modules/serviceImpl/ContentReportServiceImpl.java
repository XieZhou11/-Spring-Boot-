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
import java.util.function.Supplier;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** 内容举报与处置：目标行锁串行化状态变更，结论留痕并通知举报人与被处理人。 */
@Service
public class ContentReportServiceImpl implements ContentReportService {
    private static final Logger LOG=LoggerFactory.getLogger(ContentReportServiceImpl.class);
    private static final ZoneId ZONE=ZoneId.of("Asia/Shanghai");
    /** 通用举报允许的目标类型；评价举报由既有流程单独处理。 */
    private static final Set<String> TYPES=Set.of("WORK","COMMENT","CREATOR_PROFILE");
    private final ContentReportMapper reports; private final UserAccountMapper users; private final FileAssetMapper files;
    private final WorkService works; private final AdminUserService admins; private final WorkCommentImageService images;
    private final OperationLogService logs; private final NotificationService notifications;
    private final ObjectMapper json; private final Clock clock;
    public ContentReportServiceImpl(ContentReportMapper reports,UserAccountMapper users,FileAssetMapper files,WorkService works,AdminUserService admins,WorkCommentImageService images,OperationLogService logs,NotificationService notifications,ObjectMapper json,Clock clock){
        this.reports=reports;this.users=users;this.files=files;this.works=works;this.admins=admins;this.images=images;this.logs=logs;this.notifications=notifications;this.json=json;this.clock=clock;}

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public ContentReportVO submitWorkReport(Long userId,Long workId,ContentReportDTO input){return BusinessLog.run(LOG,"作品违规举报",userId,()->{
        var w=reports.lockWork(workId);if(w==null||w.getDeletedAt()!=null||!"ONLINE".equals(w.getReviewStatus()))throw missing("作品不存在或已下架");
        return submit(userId,"WORK",workId,w.getCreatorId(),input,()->w.getTitle());
    });}

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public ContentReportVO submitCommentReport(Long userId,Long commentId,ContentReportDTO input){return BusinessLog.run(LOG,"作品评论违规举报",userId,()->{
        var c=reports.lockComment(commentId);if(c==null||c.getUserDeletedAt()!=null||!"VISIBLE".equals(c.getModerationStatus()))throw missing("评论不存在或已不可见");
        var w=reports.lockWork(c.getWorkId());if(w==null||w.getDeletedAt()!=null||!"ONLINE".equals(w.getReviewStatus()))throw missing("作品不存在或已下架");
        return submit(userId,"COMMENT",commentId,c.getAuthorId(),input,()->excerpt(c.getContent())+"（作品："+w.getTitle()+"）");
    });}

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public ContentReportVO submitProfileReport(Long userId,Long creatorId,ContentReportDTO input){return BusinessLog.run(LOG,"创作者主页违规举报",userId,()->{
        var creator=users.lockById(creatorId);if(creator==null||creator.isAdmin()||!"APPROVED".equals(creator.getCertificationStatus()))throw missing("创作者不存在或认证失效");
        return submit(userId,"CREATOR_PROFILE",creatorId,creatorId,input,()->creator.getNickname());
    });}

    /** 提交共用流程：管理员拒绝、与被处理人串行化、材料校验、处理中举报合并补证。 */
    private ContentReportVO submit(Long userId,String targetType,Long targetId,Long ownerId,ContentReportDTO input,Supplier<String> summary){
        var user=account(userId);if(user.isAdmin())throw forbidden("管理员不能提交举报");
        if(userId.equals(ownerId))throw forbidden("不能举报本人内容");
        String description=input.getDescription()==null?null:input.getDescription().strip();List<String> ids=input.getImageIds()==null?List.of():input.getImageIds();
        if((description==null||description.isBlank())&&ids.isEmpty())throw invalid("举报说明和证据图片至少填写一项");
        if(ids.size()>6||new HashSet<>(ids).size()!=ids.size())throw invalid("举报图片最多六张且不能重复");
        validateImages(userId,ids);
        var pending=reports.pending(userId,targetType,targetId);
        ReviewReport report;
        if(pending==null){report=new ReviewReport();report.setReporterId(userId);report.setTargetType(targetType);report.setTargetId(targetId);report.setReasonCode(input.getReasonCode());report.setDescription(description);report.setImageIds(json.writeValueAsString(ids));reports.insertReport(report);LOG.info("内容举报已提交：type={}, targetId={}, reportId={}, reporterId={}",targetType,targetId,report.getId(),userId);}
        else{reports.addEvidence(pending.getId(),userId,"SUPPLEMENT",description,json.writeValueAsString(ids));report=pending;LOG.info("内容举报重复提交合并补证：type={}, targetId={}, reportId={}, reporterId={}",targetType,targetId,report.getId(),userId);}
        logs.record(userId,false,"CONTENT_REPORT",report.getId(),"SUBMIT",null,"PENDING",null,Map.of("targetType",targetType,"targetId",targetId.toString()));
        return reportView(report,summary.get());
    }

    @Override @Transactional(readOnly=true)
    public ContentReportDetailVO detail(Long userId,Long reportId){return BusinessLog.run(LOG,"内容举报核查详情",userId,()->{
        var actor=account(userId);var report=reports.report(reportId);
        if(report==null||!TYPES.contains(report.getTargetType()))throw missing("举报不存在");
        var target=target(report);boolean admin=actor.isAdmin();
        // 详情访问限管理员、举报人及被处理人（评论举报含作品作者）。
        if(!admin&&!userId.equals(report.getReporterId())&&!Objects.equals(userId,target.ownerId())&&!Objects.equals(userId,target.extraOwner()))throw missing("举报不存在");
        var evidence=reports.evidence(reportId).stream().map(e->new ReportEvidenceVO(e.getId().toString(),e.getSubmitterId().toString(),e.getEvidenceType(),e.getContent(),ids(e.getImageIds()),time(e.getCreatedAt()))).toList();
        var history=reports.reportHistory(reportId).stream().map(h->new ReviewReportHistoryVO(h.getId().toString(),text(h.getOperatorId()),h.getAction(),h.getBeforeStatus(),h.getAfterStatus(),h.getReason(),map(h.getDetail()),time(h.getCreatedAt()))).toList();
        boolean canSupplement=!admin&&userId.equals(report.getReporterId())&&"PENDING".equals(report.getStatus());
        boolean canObjection="PROCESSED".equals(report.getStatus())&&(Objects.equals(userId,target.ownerId())||Objects.equals(userId,target.extraOwner()));
        var originalComment=admin&&"COMMENT".equals(report.getTargetType())?reports.comment(report.getTargetId()):null;
        return new ContentReportDetailVO(reportView(report,target.summary()),target.ownerId()==null?null:target.ownerId().toString(),target.summary(),target.workId()==null?null:target.workId().toString(),target.state(),
                originalComment==null?null:originalComment.getContent(),originalComment==null?List.of():ids(originalComment.getImageIds()),
                evidence,history,admin?allowedDecisions(report,target):List.of(),canSupplement,canObjection);
    });}

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public ContentReportDetailVO addEvidence(Long userId,Long reportId,ReviewReportEvidenceDTO input){return BusinessLog.run(LOG,"内容举报补充材料",userId,()->{
        var report=reports.report(reportId);if(report==null||!TYPES.contains(report.getTargetType()))throw missing("举报不存在");
        var target=target(report);lockUsers(userId,report.getReporterId(),target.ownerId(),target.extraOwner());
        var locked=reports.lockReport(reportId);
        String type;if(userId.equals(report.getReporterId())&&"PENDING".equals(locked.getStatus()))type="SUPPLEMENT";
        else if("PROCESSED".equals(locked.getStatus())&&(Objects.equals(userId,target.ownerId())||Objects.equals(userId,target.extraOwner())))type="OBJECTION";
        else throw forbidden("当前账号无权补充此举报材料");
        String content=input.getContent()==null?null:input.getContent().strip();List<String> ids=input.getImageIds()==null?List.of():input.getImageIds();
        if((content==null||content.isBlank())&&ids.isEmpty())throw invalid("说明和图片至少填写一项");
        if(ids.size()>6||new HashSet<>(ids).size()!=ids.size())throw invalid("证据图片最多六张且不能重复");
        validateImages(userId,ids);
        reports.addEvidence(reportId,userId,type,content,json.writeValueAsString(ids));
        logs.record(userId,false,"CONTENT_REPORT",reportId,type,null,type,null,Map.of("targetType",report.getTargetType(),"targetId",report.getTargetId().toString()));
        return detail(userId,reportId);
    });}

    @Override @Transactional(readOnly=true)
    public PageVO<ContentReportVO> myReports(Long userId,int page,int size){return BusinessLog.run(LOG,"本人举报查询",userId,()->{account(userId);page(page,size);
        var list=reports.reporterReports(userId,(page-1)*size,size).stream().map(r->reportView(r,summaryOf(r))).toList();
        return new PageVO<>(list,reports.reporterReportCount(userId),page,size);});}

    @Override @Transactional(readOnly=true)
    public PageVO<ContentReportVO> adminReports(Long adminId,String status,String type,int page,int size){return BusinessLog.run(LOG,"管理员举报队列查询",adminId,()->{admin(adminId);page(page,size);
        if(!Set.of("PENDING","PROCESSED","ALL").contains(status))throw invalid("举报状态无效");
        if(!Set.of("ALL","WORK","COMMENT","CREATOR_PROFILE","REVIEW").contains(type))throw invalid("举报类型无效");
        var list=reports.adminReports(status,type,(page-1)*size,size).stream().map(r->reportView(r,summaryOf(r))).toList();
        return new PageVO<>(list,reports.adminReportCount(status,type),page,size);});}

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public ContentReportVO decide(Long adminId,Long reportId,AdminContentReportDecisionDTO input){return BusinessLog.run(LOG,"管理员内容举报处置",adminId,()->{
        admin(adminId);var report=reports.report(reportId);
        if(report==null)throw missing("举报不存在");
        if("REVIEW".equals(report.getTargetType()))throw invalid("评价举报请使用评价举报处理流程");
        if(!TYPES.contains(report.getTargetType()))throw missing("举报不存在");
        var initialTarget=target(report);
        lockUsers(adminId,initialTarget.ownerId(),initialTarget.extraOwner());
        var locked=reports.lockReport(reportId);
        if(locked==null)throw missing("举报不存在");
        if(input.getExpectedHistoryId()!=null&&!input.getExpectedHistoryId().equals(Objects.requireNonNullElse(reports.decisionEventId(reportId,"CONTENT_REPORT"),0L))){
            throw conflict("举报处置历史已更新，请刷新后复核");
        }
        var target=target(locked);
        boolean correction="PROCESSED".equals(locked.getStatus());
        String decision=input.getDecision().strip();
        // 处置动作按目标类型限定，避免评论举报触发作品下架等错误状态变更。
        Set<String> allowed=switch(report.getTargetType()){case "WORK"->Set.of("NOT_UPHELD","OFFLINE","RESTORE");case "COMMENT"->Set.of("NOT_UPHELD","HIDE","RESTORE");default->Set.of("NOT_UPHELD","PAUSE","RESUME");};
        if(!allowed.contains(decision))throw invalid("处置结论不适用于该举报类型");
        if(!allowedDecisions(locked,target).contains(decision))throw conflict("当前状态不支持该处置，请刷新后重试");
        String reason=input.getReason().strip();
        if(reason.isBlank())throw invalid("请填写处理依据");
        String recovery=input.getRecoveryCondition()==null?null:input.getRecoveryCondition().strip();
        if("PAUSE".equals(decision)&&(recovery==null||recovery.isBlank()))throw invalid("暂停新业务时必须填写恢复条件");
        Map<String,Object> facts=new LinkedHashMap<>();
        facts.put("targetType",report.getTargetType());
        facts.put("targetId",report.getTargetId().toString());
        facts.put("decision",decision);
        facts.put("originalState",target.state());
        apply(adminId,locked,decision,reason,recovery,facts);
        String result="NOT_UPHELD".equals(decision)?"NOT_UPHELD":"ACTION_TAKEN";
        LocalDateTime now=now();
        if(correction)reports.correctReport(reportId,result,adminId,now);else reports.decideReport(reportId,result,adminId,now);
        logs.record(adminId,true,"CONTENT_REPORT",reportId,correction?"CORRECT":"DECIDE",locked.getLatestResult(),result,reason,facts);
        notifyParties(locked,target,decision,reports.decisionEventId(reportId,"CONTENT_REPORT"));
        return reportView(reports.report(reportId),summaryOf(report));
    });}

    @Override public ImageVO image(Long userId,Long fileId){return images.viewReport(userId,fileId);}

    /** 详情和写请求共享状态判断。恢复只允许撤销本举报仍然生效的处置。 */
    private List<String> allowedDecisions(ReviewReport report,Target target){
        var actions=new ArrayList<String>();
        actions.add("NOT_UPHELD");
        var moderation=map(reports.lastModeration(report.getTargetType(),report.getTargetId()));
        boolean owns="PROCESSED".equals(report.getStatus())&&report.getId().toString().equals(moderation.get("reportId"));
        switch(report.getTargetType()){
            case "WORK"->{
                if("ONLINE".equals(target.state()))actions.add("OFFLINE");
                if(owns&&"OFFLINE".equals(moderation.get("decision"))
                        &&works.canRestoreReportedWork(report.getTargetId(),longField(moderation,"offlineVersion"),longField(moderation,"operationId")))actions.add("RESTORE");
            }
            case "COMMENT"->{
                if("VISIBLE".equals(target.state()))actions.add("HIDE");
                if(owns&&"HIDDEN".equals(target.state())&&"HIDE".equals(moderation.get("decision")))actions.add("RESTORE");
            }
            case "CREATOR_PROFILE"->{
                if("ACTIVE".equals(target.state()))actions.add("PAUSE");
                if(owns&&"PAUSED".equals(target.state())&&"PAUSE".equals(moderation.get("decision"))){
                    Long lastAccount=reports.latestAccountDecision(report.getTargetId());
                    Long pausedAt=longField(moderation,"accountEventId");
                    Long reportEvent=longField(moderation,"operationId");
                    if(lastAccount!=null&&(Objects.equals(pausedAt,lastAccount)||(pausedAt==null&&lastAccount<reportEvent)))actions.add("RESUME");
                }
            }
            default->{}
        }
        return actions;
    }

    /** 复用作品和账号处置服务，评论恢复由条件更新防止覆盖作者自删。 */
    private void apply(Long adminId,ReviewReport report,String decision,String reason,String recovery,Map<String,Object> facts){
        switch(decision){
            case "OFFLINE"->{
                var w=reports.lockWork(report.getTargetId());
                if(w==null||!"ONLINE".equals(w.getReviewStatus()))throw conflict("作品已下架或不可用");
                facts.put("offlineVersion",works.offline(adminId,w.getId(),versionDTO(w.getVersion()),reason,true,report.getId()).version());
            }
            case "RESTORE"->{
                if("COMMENT".equals(report.getTargetType())){
                    if(reports.restoreComment(report.getTargetId())!=1)throw conflict("评论当前状态不能恢复");
                }else{
                    var prior=map(reports.lastModeration("WORK",report.getTargetId()));
                    works.restoreReportedWork(adminId,report.getTargetId(),longField(prior,"offlineVersion"),longField(prior,"operationId"),reason);
                }
            }
            case "HIDE"->{if(reports.hideComment(report.getTargetId())!=1)throw conflict("评论当前状态不能隐藏");}
            case "PAUSE","RESUME"->{
                boolean paused="PAUSE".equals(decision);
                var dto=new AdminBusinessPauseDTO();
                dto.setPaused(paused);
                dto.setReason(reason);
                dto.setRecoveryCondition(paused?recovery:null);
                admins.setBusinessPause(adminId,report.getTargetId(),dto,report.getId());
                facts.put("accountEventId",reports.latestAccountDecision(report.getTargetId()));
                if(paused)facts.put("recoveryCondition",recovery);
            }
            default->{}
        }
    }

    /** 处置通知：举报人始终收到结果；作品下架由作品服务通知作者，暂停恢复由账号服务通知被处置用户。 */
    private void notifyParties(ReviewReport report,Target target,String decision,Long eventId){
        Long reporter=report.getReporterId();Long owner=target.ownerId();
        // 暂停与恢复动作本身会向被处置用户发送账号处置通知，此处不再重复。
        boolean ownerNotifiedByAction="CREATOR_PROFILE".equals(report.getTargetType())&&("PAUSE".equals(decision)||"RESUME".equals(decision))||"WORK".equals(report.getTargetType())&&"OFFLINE".equals(decision);
        String result=switch(decision){
            case "NOT_UPHELD"->"举报经本次核查未成立。";
            case "RESTORE"->"管理员复核后已恢复相关内容。";
            case "RESUME"->"管理员复核后已恢复账号的新业务资格。";
            default->"管理员已核实并处置相关内容。";
        };
        notifications.reportDecided(reporter,report.getId(),eventId,false,"举报已处理",result);
        if(owner!=null&&!owner.equals(reporter)&&!ownerNotifiedByAction){
            notifications.reportDecided(owner,report.getId(),eventId,false,"与你相关的举报已完成核查",result+"可在举报详情提交异议。");
        }
    }

    /** 目标快照：摘要、被处理人、评论关联作品及当前状态；评论举报的作品作者可参与异议。 */
    private Target target(ReviewReport report){return switch(report.getTargetType()){
        case "WORK"->{var w=reports.work(report.getTargetId());if(w==null)yield new Target(null,null,"作品已删除","不可用",null);yield new Target(w.getCreatorId(),null,"作品："+workTitle(w.getId()),w.getDeletedAt()!=null?"不可用":w.getReviewStatus(),null);}
        case "COMMENT"->{var c=reports.comment(report.getTargetId());if(c==null)yield new Target(null,null,"评论已删除","不可用",null);var w=reports.work(c.getWorkId());yield new Target(c.getAuthorId(),w==null?null:w.getCreatorId(),"评论："+excerpt(c.getContent())+"（作品："+workTitle(c.getWorkId())+"）",c.getUserDeletedAt()!=null?"DELETED":c.getModerationStatus(),c.getWorkId());}
        case "CREATOR_PROFILE"->{var u=users.findById(report.getTargetId());if(u==null)yield new Target(null,null,"用户已注销","不可用",null);yield new Target(u.getId(),null,"创作者主页："+u.getNickname(),u.isAdminBusinessPaused()?"PAUSED":"ACTIVE",null);}
        default->new Target(null,null,"未知目标","不可用",null);
    };}

    private String summaryOf(ReviewReport r){return switch(r.getTargetType()){
        case "WORK"->workTitle(r.getTargetId());
        case "COMMENT"->{var c=reports.commentContent(r.getTargetId());yield c==null?"评论已删除":excerpt(c);}
        case "CREATOR_PROFILE"->{var u=users.findById(r.getTargetId());yield u==null?"用户已注销":"创作者主页："+u.getNickname();}
        case "REVIEW"->{var c=reports.reviewContent(r.getTargetId());yield c==null?"评价已删除":"评价："+excerpt(c);}
        default->"未知目标";
    };}

    private ContentReportVO reportView(ReviewReport r,String summary){return new ContentReportVO(r.getId().toString(),r.getTargetType(),r.getTargetId().toString(),summary,r.getReasonCode(),r.getDescription(),ids(r.getImageIds()),r.getStatus(),r.getLatestResult(),reports.decisionReason(r.getId(),"REVIEW".equals(r.getTargetType())?"REVIEW_REPORT":"CONTENT_REPORT"),time(r.getCreatedAt()),time(r.getLastProcessedAt()));}
    private String workTitle(Long id){return Objects.requireNonNullElse(works.reportedWorkTitle(id),"不可用");}
    /** 兼容早期未保存版本的处置历史。 */
    private Long longField(Map<String,Object> details,String field){var value=details.get(field);return value==null?null:Long.valueOf(value.toString());}
    private String excerpt(String content){if(content==null)return "";return content.length()>60?content.substring(0,60)+"…":content;}
    private WorkVersionDTO versionDTO(Long version){var dto=new WorkVersionDTO();dto.setVersion(version);return dto;}
    private void validateImages(Long user,List<String> ids){for(Long id:ids.stream().map(Long::valueOf).sorted().toList()){var f=files.lockById(id);if(f==null||!user.equals(f.getUploaderId())||!"AVAILABLE".equals(f.getUploadStatus())||!f.getObjectKey().startsWith("work-comments/"))throw invalid("图片须为本人已上传且可用的证据图片");}}
    private void lockUsers(Long... ids){Arrays.stream(ids).filter(Objects::nonNull).distinct().sorted().forEach(id->{if(users.lockById(id)==null)throw missing("用户不存在");});}
    private UserAccount account(Long id){var u=users.findById(id);if(u==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);return u;}
    private void admin(Long id){if(!account(id).isAdmin())throw forbidden("仅管理员可处理举报");}
    private void page(int p,int s){if(p<1||p>1_000_000||s<1||s>50)throw invalid("分页参数无效");}
    private LocalDateTime now(){return LocalDateTime.ofInstant(clock.instant(),ZONE).truncatedTo(java.time.temporal.ChronoUnit.MILLIS);}
    private OffsetDateTime time(LocalDateTime v){return v==null?null:v.atZone(ZONE).toOffsetDateTime();}
    private List<String> ids(String value){return value==null?List.of():json.readValue(value,new TypeReference<List<String>>(){});}
    private Map<String,Object> map(String value){return value==null?Map.of():json.readValue(value,new TypeReference<Map<String,Object>>(){});}
    private String text(Long value){return value==null?null:value.toString();}
    private static BusinessException missing(String m){return new BusinessException(CommonErrorCode.NOT_FOUND,m);}
    private static BusinessException invalid(String m){return new BusinessException(CommonErrorCode.INVALID_REQUEST,m);}
    private static BusinessException conflict(String m){return new BusinessException(CommonErrorCode.CONFLICT,m);}
    private static BusinessException forbidden(String m){return new BusinessException(CommonErrorCode.FORBIDDEN,m);}
    /** 目标快照内部载体。 */
    private record Target(Long ownerId,Long extraOwner,String summary,String state,Long workId){}
}
