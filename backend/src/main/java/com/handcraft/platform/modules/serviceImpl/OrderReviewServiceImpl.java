package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.content.PlainTextPolicy;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.*;
import java.time.*;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.regex.Pattern;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** 锁定交易参与账号和订单后校验评价窗口，评价、举报结论及通知日志同事务提交。 */
@Service
public class OrderReviewServiceImpl implements OrderReviewService {
    private static final Logger LOG=LoggerFactory.getLogger(OrderReviewServiceImpl.class);
    private static final ZoneId ZONE=ZoneId.of("Asia/Shanghai");
    private static final Pattern BLOCKED=Pattern.compile("(?is)<\\s*(script|iframe|object|embed)\\b|javascript\\s*:|on(?:error|load|click)\\s*=|傻[逼屄]|操你妈|去死|(?:加|联系|私加).{0,10}(?:微信|微.?信|QQ|qq|vx|VX)|https?://|www\\.");
    private final OrderReviewMapper reviews; private final TradeOrderMapper orders; private final UserAccountMapper users;
    private final FileAssetMapper files; private final WorkCommentImageService images; private final CreatorReputationService reputations;
    private final ConversationMapper conversations;
    private final NotificationService notifications; private final OperationLogService logs; private final ObjectMapper json; private final Clock clock;
    public OrderReviewServiceImpl(OrderReviewMapper reviews,TradeOrderMapper orders,UserAccountMapper users,FileAssetMapper files,WorkCommentImageService images,CreatorReputationService reputations,ConversationMapper conversations,NotificationService notifications,OperationLogService logs,ObjectMapper json,Clock clock){this.reviews=reviews;this.orders=orders;this.users=users;this.files=files;this.images=images;this.reputations=reputations;this.conversations=conversations;this.notifications=notifications;this.logs=logs;this.json=json;this.clock=clock;}

    @Override @Transactional(readOnly=true)
    public OrderReviewVO orderReview(Long userId,Long orderId){return BusinessLog.run(LOG,"订单评价及资格查询",userId,()->{
        var order=orders.find(orderId);if(order==null||!userId.equals(order.getBuyerId())&&!userId.equals(order.getCreatorId()))throw missing();
        return view(reviews.byOrder(orderId),order,userId);
    });}

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public OrderReviewVO create(Long userId,Long orderId,OrderReviewDTO input){return BusinessLog.run(LOG,"买家订单评价",userId,()->{
        var initial=orders.find(orderId);if(initial==null)throw missing();lockUsers(userId,initial.getCreatorId());
        var buyer=users.findById(userId);if(buyer==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);if(buyer.isAdmin())throw forbidden("管理员不能提交订单评价");
        var order=orders.lock(orderId);if(order==null||!userId.equals(order.getBuyerId()))throw missing();
        LocalDateTime now=now();var existing=reviews.byOrder(orderId);
        if(existing!=null)throw conflict("该订单已提交评价，评价提交后不可修改");
        eligible(order,now);
        String content=input.getContent()==null?"":input.getContent().strip();int length=content.codePointCount(0,content.length());
        if(length<10||length>500)throw invalid("评价文字须为10至500字");
        if(!PlainTextPolicy.safe(content)||BLOCKED.matcher(content).find())throw invalid("评价包含违规内容，请修改后提交");
        List<String> imageIds=input.getImageIds()==null?List.of():input.getImageIds();if(imageIds.size()>3||new HashSet<>(imageIds).size()!=imageIds.size())throw invalid("评价图片最多三张且不能重复");
        validateImages(userId,imageIds);
        var review=new OrderReview();review.setOrderId(orderId);review.setBuyerId(userId);review.setCreatorId(order.getCreatorId());review.setRating(input.getRating());review.setContent(content);review.setImageIds(json.writeValueAsString(imageIds));review.setModerationStatus("VISIBLE");reviews.insert(review);
        logs.record(userId,false,"ORDER_REVIEW",review.getId(),"CREATE",null,"VISIBLE",null,Map.of("orderId",orderId.toString(),"rating",input.getRating()));
        notifications.tradeChanged(order.getCreatorId(),"ORDER_REVIEWED","ORDER",order.getId(),order.getRequestId());
        LOG.info("订单评价已保存：orderId={}, reviewId={}, creatorId={}, rating={}",orderId,review.getId(),order.getCreatorId(),review.getRating());
        return view(review,order,userId);
    });}

    @Override @Transactional(readOnly=true)
    public PageVO<CreatorReviewVO> creatorReviews(Long userId,Long creatorId,int page,int size){return BusinessLog.run(LOG,"创作者公开评价查询",userId,()->{
        account(userId);var creator=users.findById(creatorId);if(creator==null||creator.isAdmin()||!"APPROVED".equals(creator.getCertificationStatus()))throw missing();page(page,size);long total=reviews.creatorCount(creatorId);
        var items=reviews.creatorPage(creatorId,(page-1)*size,size).stream().map(r->publicView(userId,r)).toList();
        return new PageVO<>(items,total,page,size);
    });}

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public ReviewReportVO report(Long userId,Long reviewId,ReviewReportDTO input){return BusinessLog.run(LOG,"评价违规举报",userId,()->{
        var initial=reviews.find(reviewId);if(initial==null)throw missing();lockUsers(userId,initial.getBuyerId(),initial.getCreatorId());
        var user=users.findById(userId);if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);if(user.isAdmin())throw forbidden("管理员不能举报评价");
        var review=reviews.lock(reviewId);if(review==null||userId.equals(review.getBuyerId())||userId.equals(review.getCreatorId()))throw forbidden("评价交易参与方不能举报该评价");
        String description=input.getDescription()==null?null:input.getDescription().strip();List<String> ids=input.getImageIds()==null?List.of():input.getImageIds();
        if((description==null||description.isBlank())&&ids.isEmpty())throw invalid("举报说明和证据图片至少填写一项");if(ids.size()>6||new HashSet<>(ids).size()!=ids.size())throw invalid("举报图片最多六张且不能重复");validateImages(userId,ids);
        var pending=reviews.pending(userId,reviewId);
        if(pending==null){pending=new ReviewReport();pending.setReporterId(userId);pending.setTargetId(reviewId);pending.setReasonCode(input.getReasonCode());pending.setDescription(description);pending.setImageIds(json.writeValueAsString(ids));reviews.insertReport(pending);}
        else reviews.addEvidence(pending.getId(),userId,"SUPPLEMENT",description,json.writeValueAsString(ids));
        logs.record(userId,false,"REVIEW_REPORT",pending.getId(),"SUBMIT",null,"PENDING",null,Map.of("reviewId",reviewId.toString()));
        LOG.info("评价举报已提交：reviewId={}, reportId={}, reporterId={}",reviewId,pending.getId(),userId);return reportView(pending);
    });}

    @Override @Transactional(readOnly=true)
    public ReviewReportDetailVO reportDetail(Long userId,Long reportId){return BusinessLog.run(LOG,"评价举报核查详情",userId,()->{
        var report=reviews.report(reportId);if(report==null||!"REVIEW".equals(report.getTargetType()))throw missing();var review=reviews.find(report.getTargetId());if(review==null)throw missing();var order=orders.find(review.getOrderId());
        var actor=account(userId);if(!actor.isAdmin()&&!userId.equals(report.getReporterId())&&!userId.equals(review.getBuyerId())&&!userId.equals(review.getCreatorId()))throw missing();
        var ref=reviews.orderAndConversation(review.getId());Object convo=ref==null?null:ref.get("conversation_id");
        var evidence=reviews.evidence(reportId).stream().map(e->new ReportEvidenceVO(e.getId().toString(),e.getSubmitterId().toString(),e.getEvidenceType(),e.getContent(),ids(e.getImageIds()),time(e.getCreatedAt()))).toList();
        boolean isAdmin=actor.isAdmin();var messages=new ArrayList<ChatMessageVO>();if(isAdmin&&convo!=null){Long conversationId=((Number)convo).longValue();for(var m:conversations.messages(conversationId,null,0L,100))messages.add(new ChatMessageVO(m.getId().toString(),conversationId.toString(),m.getSeqNo().toString(),m.getSenderId().toString(),m.getClientMessageKey(),m.getContent(),ids(m.getImageIds()),time(m.getCreatedAt()),m.getReferencedNodeId()==null?null:m.getReferencedNodeId().toString(),m.getReferencedNodeCode()));}
        var history=reviews.reportHistory(reportId).stream().map(h->new ReviewReportHistoryVO(h.getId().toString(),text(h.getOperatorId()),h.getAction(),h.getBeforeStatus(),h.getAfterStatus(),h.getReason(),map(h.getDetail()),time(h.getCreatedAt()))).toList();
        return new ReviewReportDetailVO(reportView(report),view(review,order,userId),order.getId().toString(),order.getOrderNo(),convo==null?null:convo.toString(),order.getBuyerId().toString(),order.getCreatorId().toString(),evidence,messages,history);
    });}

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public ReviewReportDetailVO addEvidence(Long userId,Long reportId,ReviewReportEvidenceDTO input){return BusinessLog.run(LOG,"评价举报补充证据",userId,()->{
        var initial=reviews.report(reportId);if(initial==null||!"REVIEW".equals(initial.getTargetType()))throw missing();var initialReview=reviews.find(initial.getTargetId());if(initialReview==null)throw missing();
        lockUsers(userId,initial.getReporterId(),initialReview.getBuyerId(),initialReview.getCreatorId());var review=reviews.lock(initialReview.getId());var report=reviews.lockReport(reportId);var actor=users.findById(userId);
        if(actor==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        String type;if(userId.equals(report.getReporterId())&&"PENDING".equals(report.getStatus()))type="SUPPLEMENT";
        else if((userId.equals(review.getBuyerId())||userId.equals(review.getCreatorId()))&&"PROCESSED".equals(report.getStatus()))type="OBJECTION";
        else throw forbidden("当前账号无权补充此举报材料");
        String content=input.getContent()==null?null:input.getContent().strip();List<String> ids=input.getImageIds()==null?List.of():input.getImageIds();if((content==null||content.isBlank())&&ids.isEmpty())throw invalid("说明和图片至少填写一项");if(ids.size()>6||new HashSet<>(ids).size()!=ids.size())throw invalid("证据图片最多六张且不能重复");validateImages(userId,ids);
        reviews.addEvidence(reportId,userId,type,content,json.writeValueAsString(ids));logs.record(userId,false,"REVIEW_REPORT",reportId,type,null,type,null,Map.of("reviewId",review.getId().toString()));
        return reportDetail(userId,reportId);
    });}

    @Override public PageVO<ReviewReportVO> myReports(Long userId,int page,int size){return BusinessLog.run(LOG,"本人评价举报查询",userId,()->{account(userId);page(page,size);var list=reviews.reporterReports(userId,(page-1)*size,size).stream().map(this::reportView).toList();return new PageVO<>(list,reviews.reporterReportCount(userId),page,size);});}
    @Override public List<ReviewReportVO> reviewReports(Long userId,Long reviewId){return BusinessLog.run(LOG,"评价关联举报查询",userId,()->{var actor=account(userId);var review=reviews.find(reviewId);if(review==null||!actor.isAdmin()&&!userId.equals(review.getBuyerId())&&!userId.equals(review.getCreatorId())&&reviews.hasReported(userId,reviewId)==0)throw missing();return reviews.reviewReports(reviewId).stream().map(this::reportView).toList();});}
    @Override public PageVO<ReviewReportVO> adminReports(Long adminId,String status,int page,int size){return BusinessLog.run(LOG,"管理员评价举报队列查询",adminId,()->{admin(adminId);page(page,size);if(!Set.of("PENDING","PROCESSED","ALL").contains(status))throw invalid("举报状态无效");var list=reviews.adminReports(status,(page-1)*size,size).stream().map(this::reportView).toList();return new PageVO<>(list,reviews.adminReportCount(status),page,size);});}

    @Override @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public ReviewReportVO decide(Long adminId,Long reportId,AdminReviewReportDecisionDTO input){return BusinessLog.run(LOG,"管理员评价举报处置",adminId,()->{
        admin(adminId);var report=reviews.report(reportId);if(report==null||!"REVIEW".equals(report.getTargetType()))throw missing();var initial=reviews.find(report.getTargetId());if(initial==null)throw missing();lockUsers(adminId,initial.getBuyerId(),initial.getCreatorId());
        var review=reviews.lock(report.getTargetId());var locked=reviews.lockReport(reportId);boolean correction=locked!=null&&"PROCESSED".equals(locked.getStatus());
        if(locked==null||correction&&!Set.of("RESTORE","HIDE","DELETE","NOT_UPHELD").contains(input.getDecision())||!correction&&(!"PENDING".equals(locked.getStatus())||"RESTORE".equals(input.getDecision())))throw conflict("举报已处理或结论不适用于当前状态");
        if("RESTORE".equals(input.getDecision())&&reviews.hasModerationAction(reportId)==0)throw conflict("本举报未产生隐藏或删除，不能通过更正恢复评价");
        String original=reviews.originalModerationStatus(reportId);if(original==null)original=review.getModerationStatus();String status=switch(input.getDecision()){case "HIDE"->"HIDDEN";case "DELETE"->"DELETED";case "RESTORE"->original;default->review.getModerationStatus();};
        if(Set.of("HIDE","DELETE","RESTORE").contains(input.getDecision()))reviews.moderate(review.getId(),status);
        String result="NOT_UPHELD".equals(input.getDecision())?"NOT_UPHELD":"ACTION_TAKEN";LocalDateTime now=now();
        if(correction)reviews.correctReport(reportId,result,adminId,now);else reviews.decideReport(reportId,result,adminId,now);
        logs.record(adminId,true,"REVIEW_REPORT",reportId,correction?"CORRECT":"DECIDE",locked.getLatestResult(),result,input.getReason(),Map.of("reviewId",review.getId().toString(),"decision",input.getDecision(),"beforeModerationStatus",review.getModerationStatus(),"originalModerationStatus",original,"moderationStatus",status));
        notifications.tradeChanged(locked.getReporterId(),"REVIEW_REPORT_PROCESSED","REVIEW_REPORT",reportId,null);
        notifications.tradeChanged(review.getBuyerId(),"REVIEW_REPORT_PROCESSED","REVIEW_REPORT",reportId,null);
        if(!review.getCreatorId().equals(review.getBuyerId()))notifications.tradeChanged(review.getCreatorId(),"REVIEW_REPORT_PROCESSED","REVIEW_REPORT",reportId,null);
        LOG.info("评价举报处置已提交：reportId={}, reviewId={}, decision={}",reportId,review.getId(),input.getDecision());return reportView(reviews.report(reportId));
    });}

    @Override public ImageVO image(Long userId,Long fileId){return images.viewReview(userId,fileId);}
    private OrderReviewVO view(OrderReview r,TradeOrder o,Long user){var viewer=users.findById(user);boolean admin=viewer!=null&&viewer.isAdmin();boolean buyer=user.equals(o.getBuyerId());LocalDateTime deadline=o.getOriginalCompletedAt()==null?null:o.getOriginalCompletedAt().plusDays(7);boolean canCreate=buyer&&r==null&&deadline!=null&&"COMPLETED".equals(o.getStatus())&&now().isBefore(deadline);
        if(r==null)return new OrderReviewVO(null,o.getId().toString(),null,null,null,List.of(),null,buyer,false,canCreate,time(deadline));
        boolean related=buyer||user.equals(o.getCreatorId());boolean publicVisible="VISIBLE".equals(r.getModerationStatus())&& !"REFUNDED".equals(o.getStatus());boolean canSee=related||admin||publicVisible;
        return new OrderReviewVO(r.getId().toString(),o.getId().toString(),canSee?nickname(r.getBuyerId()):null,canSee?r.getRating():null,canSee?r.getContent():null,signedImages(user,r.getImageIds(),canSee&&(related||admin||publicVisible)),time(r.getCreatedAt()),related||admin||publicVisible,publicVisible&&!buyer&&!user.equals(o.getCreatorId()),false,time(deadline));}
    private CreatorReviewVO publicView(Long userId,OrderReview r){var buyer=users.findById(r.getBuyerId());return new CreatorReviewVO(r.getId().toString(),buyer==null?"已注销用户":buyer.getNickname(),r.getRating(),r.getContent(),signedImages(userId,r.getImageIds(),true),!userId.equals(r.getBuyerId())&&!userId.equals(r.getCreatorId()),time(r.getCreatedAt()));}
    private List<ImageVO> signedImages(Long user,String value,boolean allowed){if(!allowed)return List.of();List<String> ids=ids(value);return ids.stream().map(id->{try{return images.viewReview(user,Long.valueOf(id));}catch(BusinessException ignored){return null;}}).filter(Objects::nonNull).toList();}
    private ReviewReportVO reportView(ReviewReport r){return new ReviewReportVO(r.getId().toString(),r.getTargetId().toString(),r.getReporterId().toString(),r.getReasonCode(),r.getDescription(),ids(r.getImageIds()),r.getStatus(),r.getLatestResult(),reviews.decisionReason(r.getId()),time(r.getCreatedAt()),time(r.getLastProcessedAt()));}
    private String nickname(Long id){var u=users.findById(id);return u==null?"已注销用户":u.getNickname();}
    private void eligible(TradeOrder o,LocalDateTime now){if(!"COMPLETED".equals(o.getStatus())||o.getOriginalCompletedAt()==null||!now.isBefore(o.getOriginalCompletedAt().plusDays(7)))throw conflict("仅订单原完成时间后七天内可评价");}
    private void validateImages(Long user,List<String> ids){for(Long id:ids.stream().map(Long::valueOf).sorted().toList()){var f=files.lockById(id);if(f==null||!user.equals(f.getUploaderId())||!"AVAILABLE".equals(f.getUploadStatus())||!f.getObjectKey().startsWith("work-comments/"))throw invalid("图片须为本人已上传且可用的评价图片");}}
    private void lockUsers(Long... ids){Arrays.stream(ids).filter(Objects::nonNull).distinct().sorted().forEach(id->{if(users.lockById(id)==null)throw missing();});}
    private UserAccount account(Long id){var u=users.findById(id);if(u==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);return u;}
    private void admin(Long id){if(!account(id).isAdmin())throw forbidden("仅管理员可处理评价举报");}
    private LocalDateTime now(){return LocalDateTime.ofInstant(clock.instant(),ZONE).truncatedTo(java.time.temporal.ChronoUnit.MILLIS);}
    private OffsetDateTime time(LocalDateTime v){return v==null?null:v.atZone(ZONE).toOffsetDateTime();}
    private List<String> ids(String value){return value==null?List.of():json.readValue(value,new TypeReference<List<String>>(){});}
    private Map<String,Object> map(String value){return value==null?Map.of():json.readValue(value,new TypeReference<Map<String,Object>>(){});}
    private String text(Long value){return value==null?null:value.toString();}
    private void page(int p,int s){if(p<1||p>1_000_000||s<1||s>50)throw invalid("分页参数无效");}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
    private static BusinessException invalid(String m){return new BusinessException(CommonErrorCode.INVALID_REQUEST,m);}
    private static BusinessException conflict(String m){return new BusinessException(CommonErrorCode.CONFLICT,m);}
    private static BusinessException forbidden(String m){return new BusinessException(CommonErrorCode.FORBIDDEN,m);}
}
