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
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** 申请材料不可变；账号锁串行化提交、撤回与审核，结论及通知同事务提交。 */
@Service
public class CreatorApplicationServiceImpl implements CreatorApplicationService {
    private final CreatorApplicationMapper applications;
    private final UserAccountMapper accounts;
    private final CategoryMapper categories;
    private final FileAssetMapper files;
    private final PaymentAccountCryptoService crypto;
    private final OperationLogService logs;
    private final NotificationService notifications;
    private final ObjectMapper json;
    public CreatorApplicationServiceImpl(CreatorApplicationMapper applications,UserAccountMapper accounts,CategoryMapper categories,FileAssetMapper files,PaymentAccountCryptoService crypto,OperationLogService logs,NotificationService notifications,ObjectMapper json){
        this.applications=applications;this.accounts=accounts;this.categories=categories;this.files=files;this.crypto=crypto;this.logs=logs;this.notifications=notifications;this.json=json;
    }
    public CreatorCertificationVO certification(Long userId){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"本人认证状态查询",userId,()->{
        UserAccount user=requireUser(userId,false);CreatorApplication latest=applications.latest(userId);
        return new CreatorCertificationVO(user.getCertificationStatus(),latest==null?null:latest.getId().toString(),text(user.getApprovedApplicationId()));
    });}
    public PageVO<ApplicationSummaryVO> list(Long userId,boolean admin,String status,int page,int size){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"认证申请列表查询",userId,()->{
        requireUser(userId,admin);checkPage(page,size);
        if(admin&&!Set.of("PENDING","APPROVED","REJECTED","WITHDRAWN").contains(status))throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"申请状态无效");
        var values=admin?applications.queue(status,(page-1)*size,size):applications.own(userId,(page-1)*size,size);
        return new PageVO<>(values.stream().map(this::summary).toList(),admin?applications.countQueue(status):applications.countOwn(userId),page,size);
    });}
    public CreatorApplicationVO detail(Long userId,Long id,boolean admin){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"认证材料查询",userId,()->{
        requireUser(userId,admin);CreatorApplication value=applications.find(id);
        if(value==null||(!admin&&!userId.equals(value.getUserId())))throw new BusinessException(CommonErrorCode.NOT_FOUND);return view(value);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Submission submit(Long userId,CreatorApplicationDTO input){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"创作者申请提交",userId,()->{
        // 品类共享锁先于账号锁，与管理员停用品类保持同一顺序。
        List<Long> categoryIds=input.getCategoryIds().stream().map(this::number).sorted().toList();
        if(new HashSet<>(categoryIds).size()!=categoryIds.size())throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"主品类不能重复");
        List<Category> selected=categoryIds.stream().map(categories::share).toList();
        UserAccount user=accounts.lockById(userId);if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        if(user.isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN,"管理员不能申请创作者资格");
        CreatorApplication repeated=applications.findRequest(userId,input.getRequestKey());
        if(repeated!=null){if(!same(repeated,input,categoryIds))throw new BusinessException(CommonErrorCode.CONFLICT,"同一请求键不能提交不同材料");return new Submission(view(repeated),false);}
        if(Set.of("PENDING","APPROVED").contains(user.getCertificationStatus()))throw new BusinessException(CommonErrorCode.CONFLICT,"已有待审核或已通过申请，不能重复提交");
        if(selected.stream().anyMatch(c->c==null||!c.isEnabled()||c.getParentId()!=null))throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"请选择启用的一级主品类");
        if(!input.getRealName().equals(input.getPayeeName()))throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"收款人姓名必须与申请人一致");
        TreeSet<Long> imageIds=new TreeSet<>();
        input.getOriginalWorks().forEach(work->{work.getFinishedImageIds().forEach(id->imageIds.add(number(id)));work.getProcessImageIds().forEach(id->imageIds.add(number(id)));});
        for(Long id:imageIds){FileAsset file=files.lockById(id);if(file==null||!userId.equals(file.getUploaderId())||!file.getObjectKey().startsWith("creator-applications/"+userId+"/")||!"AVAILABLE".equals(file.getUploadStatus()))throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"图片不可用或不属于本人入驻材料");}
        CreatorApplication a=new CreatorApplication();a.setUserId(userId);a.setRequestKey(input.getRequestKey());a.setRealName(input.getRealName());a.setContactPhone(input.getContactPhone());a.setProvince(input.getProvince());a.setCity(input.getCity());a.setDistrict(input.getDistrict());a.setExperienceYears(input.getExperienceYears());a.setIntroduction(input.getIntroduction());a.setOriginalWorks(worksJson(input));a.setSupportingDescription(input.getSupportingDescription());a.setAlipayAccountCiphertext(crypto.encrypt(userId,input.getAlipayAccount()));
        applications.insert(a);categoryIds.forEach(id->applications.insertCategory(a.getId(),id));accounts.updateCertification(userId,"PENDING",null);
        logs.record(userId,false,"CREATOR_APPLICATION",a.getId(),"SUBMIT",user.getCertificationStatus(),"PENDING",null);
        return new Submission(view(applications.find(a.getId())),true);
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public CreatorApplicationVO withdraw(Long userId,Long id){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"创作者申请撤回",userId,()->{
        var user=accounts.lockById(userId);if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        CreatorApplication a=applications.lock(id);if(a==null||!userId.equals(a.getUserId()))throw new BusinessException(CommonErrorCode.NOT_FOUND);
        if("WITHDRAWN".equals(a.getStatus()))return view(a);
        if(!"PENDING".equals(a.getStatus()))throw new BusinessException(CommonErrorCode.CONFLICT,"申请已结束，不能撤回");
        if(applications.withdraw(id)!=1)throw new BusinessException(CommonErrorCode.CONFLICT);
        accounts.updateCertification(userId,"NONE",null);logs.record(userId,false,"CREATOR_APPLICATION",id,"WITHDRAW","PENDING","WITHDRAWN",null);return view(applications.find(id));
    });}
    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public CreatorApplicationVO review(Long adminId,Long id,CreatorReviewDTO input){return BusinessLog.run(LoggerFactory.getLogger(getClass()),"创作者认证审核",adminId,()->{
        requireUser(adminId,true);CreatorApplication initial=applications.find(id);if(initial==null)throw new BusinessException(CommonErrorCode.NOT_FOUND);
        // 两名管理员或撤回并发时，统一先按编号锁相关账号，再锁申请。
        new TreeSet<>(List.of(adminId,initial.getUserId())).forEach(accounts::lockById);requireUser(adminId,true);
        CreatorApplication a=applications.lock(id);
        if(!"PENDING".equals(a.getStatus())){
            if(input.getDecision().equals(a.getStatus())&&Objects.equals(input.getReason(),a.getReviewReason()))return view(a);
            throw new BusinessException(CommonErrorCode.CONFLICT,"申请已审核或撤回，请刷新查看结果");
        }
        if("REJECTED".equals(input.getDecision())&&input.getReason().isBlank())throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"驳回必须填写具体原因");
        if(applications.review(id,adminId,input.getDecision(),input.getReason())!=1)throw new BusinessException(CommonErrorCode.CONFLICT);
        accounts.updateCertification(a.getUserId(),input.getDecision(),"APPROVED".equals(input.getDecision())?id:null);
        logs.record(adminId,true,"CREATOR_APPLICATION",id,"REVIEW","PENDING",input.getDecision(),input.getReason());
        notifications.creatorReviewed(a.getUserId(),id,input.getDecision(),input.getReason());return view(applications.find(id));
    });}
    private boolean same(CreatorApplication a,CreatorApplicationDTO input,List<Long> categoryIds){
        return Objects.equals(a.getRealName(),input.getRealName())&&Objects.equals(input.getRealName(),input.getPayeeName())&&Objects.equals(a.getContactPhone(),input.getContactPhone())&&Objects.equals(a.getProvince(),input.getProvince())&&Objects.equals(a.getCity(),input.getCity())&&Objects.equals(a.getDistrict(),input.getDistrict())&&Objects.equals(a.getExperienceYears(),input.getExperienceYears())&&Objects.equals(a.getIntroduction(),input.getIntroduction())&&Objects.equals(a.getSupportingDescription(),input.getSupportingDescription())&&json.readTree(a.getOriginalWorks()).equals(json.readTree(worksJson(input)))&&Objects.equals(applications.categoryIds(a.getId()),categoryIds)&&Objects.equals(crypto.decrypt(a.getUserId(),a.getAlipayAccountCiphertext()),input.getAlipayAccount());
    }
    private String worksJson(CreatorApplicationDTO input){return json.writeValueAsString(input.getOriginalWorks().stream().map(work->Map.of("finished_image_ids",work.getFinishedImageIds(),"process_image_ids",work.getProcessImageIds())).toList());}
    private CreatorApplicationVO view(CreatorApplication a){
        List<Long> categoryIds=applications.categoryIds(a.getId());
        List<Map<String,List<String>>> works=json.readValue(a.getOriginalWorks(),new TypeReference<>(){});
        var user=accounts.findById(a.getUserId());
        return new CreatorApplicationVO(a.getId().toString(),a.getUserId().toString(),user==null?"":user.getNickname(),a.getStatus(),a.getRealName(),a.getContactPhone(),a.getProvince(),a.getCity(),a.getDistrict(),categoryIds.stream().map(Object::toString).toList(),categoryIds.stream().map(categories::find).filter(Objects::nonNull).map(c->CategoryServiceImpl.view(c,List.of())).toList(),a.getExperienceYears(),a.getIntroduction(),works.stream().map(w->new CreatorWorkVO(w.get("finished_image_ids"),w.get("process_image_ids"))).toList(),crypto.decrypt(a.getUserId(),a.getAlipayAccountCiphertext()),a.getRealName(),a.getSupportingDescription(),text(a.getReviewerId()),a.getReviewReason(),time(a.getSubmittedAt()),time(a.getReviewedAt()),time(a.getWithdrawnAt()),text(applications.previous(a.getUserId(),a.getId())));
    }
    private ApplicationSummaryVO summary(CreatorApplication a){var user=accounts.findById(a.getUserId());return new ApplicationSummaryVO(a.getId().toString(),a.getUserId().toString(),user==null?"":user.getNickname(),a.getStatus(),time(a.getSubmittedAt()),a.getReviewReason(),time(a.getReviewedAt()),time(a.getWithdrawnAt()));}
    private UserAccount requireUser(Long id,boolean admin){var user=accounts.findById(id);if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);if(admin&&!user.isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN);return user;}
    private Long number(String value){try{long id=Long.parseLong(value);if(id>0)return id;}catch(NumberFormatException ignored){}throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"资源编号无效");}
    private static void checkPage(int page,int size){if(page<1||page>1_000_000||size<1||size>50)throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"分页参数无效");}
    private static String text(Long value){return value==null?null:value.toString();}
    private static OffsetDateTime time(LocalDateTime value){return value==null?null:value.atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime();}
}
