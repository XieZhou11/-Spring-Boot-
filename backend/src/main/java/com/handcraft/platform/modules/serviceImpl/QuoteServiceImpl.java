package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.content.PlainTextPolicy;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.exception.QuoteErrorCode;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** 报价写入共用用户与需求锁，额度以成功提交历史计数，撤回不返还日额度。 */
@Service
public class QuoteServiceImpl implements QuoteService {
    private static final Logger LOGGER=LoggerFactory.getLogger(QuoteServiceImpl.class);
    private final QuoteMapper quotes;
    private final CustomRequestMapper requests;
    private final UserAccountMapper users;
    private final FileAssetMapper files;
    private final CustomRequestPolicyService policy;
    private final QuoteLifecycleService lifecycle;
    private final CreatorReputationService reputation;
    private final NotificationService notifications;
    private final OperationLogService logs;
    private final ObjectMapper json;

    public QuoteServiceImpl(QuoteMapper quotes,CustomRequestMapper requests,UserAccountMapper users,FileAssetMapper files,
            CustomRequestPolicyService policy,QuoteLifecycleService lifecycle,CreatorReputationService reputation,
            NotificationService notifications,OperationLogService logs,ObjectMapper json) {
        this.quotes=quotes;this.requests=requests;this.users=users;this.files=files;this.policy=policy;
        this.lifecycle=lifecycle;this.reputation=reputation;this.notifications=notifications;this.logs=logs;this.json=json;
    }

    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public Creation create(Long userId,Long requestId,QuoteCreateDTO input) {
        return BusinessLog.run(LOGGER,"需求报价提交",userId,()->{
            var initial=requests.find(requestId);if(initial==null)throw missing();
            BusinessException categoryFailure=null;
            try{policy.lockTradingCategory(initial.getCategoryId());}catch(BusinessException failure){categoryFailure=failure;}
            policy.lockUsers(userId,initial.getBuyerId());
            var request=requests.lock(requestId);
            var previous=quotes.findKey(userId,input.getRequestKey());
            if(previous!=null) {
                if(!same(previous,requestId,input))throw conflict("同一请求键不能提交不同需求或报价内容");
                return new Creation(view(previous,request,userId),false);
            }
            policy.visible(userId,request,false);
            // 如果等待账号锁时草稿换类并发布，重新提交以取得当前品类的锁。
            if(!Objects.equals(initial.getCategoryId(),request.getCategoryId()))throw conflict("需求品类已变化，请刷新需求状态");
            if(categoryFailure!=null)throw categoryFailure;
            if(userId.equals(request.getBuyerId()))throw forbidden("不能为自己的需求报价");
            lifecycle.reconcile(request);policy.open(request);
            String reason=eligibility(userId,request);if(reason!=null)throw forbidden(reason);
            var active=quotes.active(requestId,policy.now());
            if(active.stream().anyMatch(quote->userId.equals(quote.getCreatorId())))throw conflict("每个需求只能保留一份有效报价");
            if(active.size()>=5)throw conflict("该需求已有五份有效报价");
            if(daily(userId)>=20)throw new BusinessException(QuoteErrorCode.DAILY_LIMIT);
            String proposal=normalize(input.getProposal()),agreement=normalize(input.getAdditionalAgreement());
            int length=proposal==null?0:proposal.codePointCount(0,proposal.length());
            if(length<30||length>1000)throw invalid("方案说明应为三十至一千字");
            if(!PlainTextPolicy.safe(proposal)||!PlainTextPolicy.safe(agreement))throw invalid("方案不能包含脚本、联系方式、外链、站外引流或不当内容");
            checkImages(userId,input.getImageIds());
            var quote=new Quote();quote.setRequestId(requestId);quote.setCreatorId(userId);quote.setCreateRequestKey(input.getRequestKey());
            quote.setGoodsAmount(input.getGoodsAmount().setScale(2));quote.setDurationDays(input.getDurationDays());
            quote.setProposal(proposal);quote.setAdditionalAgreement(agreement);quote.setImageIds(json.writeValueAsString(input.getImageIds()));
            var createdAt=policy.now();quote.setStatus("ACTIVE");quote.setCreatedAt(createdAt);quote.setUpdatedAt(createdAt);quote.setExpiresAt(createdAt.plusDays(7));
            quotes.insert(quote);lifecycle.state(request,"QUOTING",userId);
            logs.record(userId,false,"QUOTE",quote.getId(),"CREATE",null,"ACTIVE",null);
            notifications.tradeChanged(request.getBuyerId(),"QUOTE_SUBMITTED","QUOTE",quote.getId(),requestId);
            notifications.tradeChanged(userId,"QUOTE_SUBMITTED","QUOTE",quote.getId(),requestId);
            LOGGER.info("报价额度及内容已校验：userId={}, requestId={}, quoteId={}",userId,requestId,quote.getId());
            return new Creation(view(quote,request,userId),true);
        });
    }

    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public QuoteVO withdraw(Long userId,Long quoteId) {
        return BusinessLog.run(LOGGER,"报价撤回",userId,()->{
            var initial=quotes.find(quoteId);if(initial==null||!userId.equals(initial.getCreatorId()))throw missing();
            var initialRequest=requests.find(initial.getRequestId());policy.lockUsers(userId,initialRequest.getBuyerId());
            var request=requests.lock(initial.getRequestId());var history=lifecycle.reconcile(request);
            var quote=history.stream().filter(item->quoteId.equals(item.getId())).findFirst().orElseThrow(QuoteServiceImpl::missing);
            if("EXPIRED".equals(quote.getStatus())&&"WITHDRAWN".equals(quote.getInvalidReason()))return view(quote,request,userId);
            if(!"ACTIVE".equals(quote.getStatus()))throw conflict("仅有效报价可撤回");
            policy.open(request);lifecycle.invalidate(request,quote,"WITHDRAWN",userId);lifecycle.reconcile(request);
            return view(quote,request,userId);
        });
    }

    public PageVO<QuoteVO> list(Long userId,Long requestId,QuoteQueryDTO query) {
        return BusinessLog.run(LOGGER,"报价历史查询",userId,()->{
            Long creatorId=userId;
            Long selectedRequestId=requestId==null?query.getRequestId():requestId;
            if(requestId!=null) {
                var request=requests.find(requestId);if(request==null)throw missing();
                if(userId.equals(request.getBuyerId()))creatorId=null;
                else if(quotes.count(userId,requestId,"ALL",policy.now())==0)policy.visible(userId,request,false);
            }
            policy.user(userId);var now=policy.now();
            var items=quotes.list(creatorId,selectedRequestId,query.getStatus(),now,(query.getPage()-1)*query.getSize(),query.getSize());
            return new PageVO<>(items.stream().map(quote->view(quote,requests.find(quote.getRequestId()),userId)).toList(),
                    quotes.count(creatorId,selectedRequestId,query.getStatus(),now),query.getPage(),query.getSize());
        });
    }

    public QuoteVO detail(Long userId,Long quoteId) {
        return BusinessLog.run(LOGGER,"报价详情查询",userId,()->{
            var quote=quotes.find(quoteId);if(quote==null)throw missing();var request=requests.find(quote.getRequestId());
            if(!userId.equals(quote.getCreatorId())&&!userId.equals(request.getBuyerId()))throw missing();
            return view(quote,request,userId);
        });
    }

    public QuoteComparisonVO comparison(Long userId,Long requestId,String sort) {
        return BusinessLog.run(LOGGER,"多方报价对比",userId,()->{
            var request=requests.find(requestId);if(request==null||!userId.equals(request.getBuyerId()))throw missing();
            if(!Set.of("AMOUNT","DURATION","RATING").contains(sort))throw invalid("报价排序方式无效");
            var items=new ArrayList<>(quotes.active(requestId,policy.now()).stream().map(quote->view(quote,request,userId)).toList());
            Comparator<QuoteVO> ordering=switch(sort) {
                case "DURATION"->Comparator.comparingInt(QuoteVO::durationDays);
                case "RATING"->Comparator.comparing(quote->quote.averageRating()==null?null:new BigDecimal(quote.averageRating()),Comparator.nullsLast(Comparator.reverseOrder()));
                default->Comparator.comparing(quote->new BigDecimal(quote.goodsAmount()));
            };
            items.sort(ordering.thenComparing(quote->Long.valueOf(quote.id())));
            String reason=awardReason(request);
            if(reason==null&&items.stream().noneMatch(QuoteVO::canAward))reason="暂无可定标的有效报价";
            return new QuoteComparisonVO(requestId.toString(),request.getTitle(),request.getExpectedShipDate(),items,items.size(),5,reason==null,reason,policy.now().toLocalDate());
        });
    }

    public QuoteQuotaVO quota(Long userId) {
        return BusinessLog.run(LOGGER,"报价日额度查询",userId,()->{policy.user(userId);long used=daily(userId);return new QuoteQuotaVO(used,20,Math.max(0,20-used));});
    }

    public String submissionReason(Long userId,Long requestId) {
        var request=requests.find(requestId);if(request==null)return "需求不存在";
        if(userId.equals(request.getBuyerId()))return "不能为自己的需求报价";
        if(!Set.of("OPEN","QUOTING").contains(policy.effectiveStatus(request)))return "需求未开放或已结束";
        String reason=eligibility(userId,request);if(reason!=null)return reason;
        var active=quotes.active(requestId,policy.now());
        if(active.stream().anyMatch(quote->userId.equals(quote.getCreatorId())))return "已提交有效报价，可撤回后重新提交";
        if(active.size()>=5)return "该需求已有五份有效报价";
        return daily(userId)>=20?"今日报价已达二十次上限":null;
    }

    private String eligibility(Long userId,CustomRequest request) {
        if("DIRECTED".equals(request.getVisibility())&&!userId.equals(request.getInvitedCreatorId()))return "仅受邀创作者可报价";
        if(users.findById(request.getBuyerId()).isAdminBusinessPaused())return "需求买家新业务已暂停";
        return policy.creatorReason(users.findById(userId),request.getCategoryId());
    }

    private String awardReason(CustomRequest request) {
        if(!Set.of("OPEN","QUOTING").contains(policy.effectiveStatus(request)))return "需求已关闭、过期或定标";
        return users.findById(request.getBuyerId()).isAdminBusinessPaused()?"账号新业务已暂停":null;
    }

    private QuoteVO view(Quote quote,CustomRequest request,Long userId) {
        var author=users.findById(quote.getCreatorId());var summary=reputation.summary(quote.getCreatorId());
        boolean expired="ACTIVE".equals(quote.getStatus())&&!policy.now().isBefore(quote.getExpiresAt());
        String status=expired?"EXPIRED":quote.getStatus();boolean owned=userId.equals(quote.getCreatorId());
        boolean active="ACTIVE".equals(status)&&Set.of("OPEN","QUOTING").contains(policy.effectiveStatus(request));
        return new QuoteVO(quote.getId().toString(),request.getId().toString(),request.getTitle(),quote.getCreatorId().toString(),
                author.getNickname(),quote.getGoodsAmount().setScale(2).toPlainString(),quote.getDurationDays(),quote.getProposal(),
                quote.getAdditionalAgreement(),ids(quote.getImageIds()),status,expired?"TIMEOUT":quote.getInvalidReason(),
                time(quote.getCreatedAt()),time(quote.getExpiresAt()),policy.now().toLocalDate().plusDays(quote.getDurationDays()),
                summary.averageRating(),summary.reviewCount(),summary.positiveRate(),summary.completedOrderCount(),owned,owned&&active,
                userId.equals(request.getBuyerId())&&active&&awardReason(request)==null&&policy.creatorReason(author,request.getCategoryId())==null);
    }

    private long daily(Long userId) {var start=policy.now().toLocalDate().atStartOfDay();return quotes.daily(userId,start,start.plusDays(1));}
    private boolean same(Quote quote,Long requestId,QuoteCreateDTO input) {
        return requestId.equals(quote.getRequestId())&&quote.getGoodsAmount().compareTo(input.getGoodsAmount())==0
                &&quote.getDurationDays().equals(input.getDurationDays())&&Objects.equals(quote.getProposal(),normalize(input.getProposal()))
                &&Objects.equals(quote.getAdditionalAgreement(),normalize(input.getAdditionalAgreement()))&&ids(quote.getImageIds()).equals(input.getImageIds());
    }
    private void checkImages(Long userId,List<String> imageIds) {
        if(new HashSet<>(imageIds).size()!=imageIds.size())throw invalid("报价图片不能重复");
        imageIds.stream().map(QuoteServiceImpl::number).sorted().forEach(id->{
            var file=files.lockById(id);
            if(file==null||!userId.equals(file.getUploaderId())||!file.getObjectKey().startsWith("quotes/"+userId+"/")||!"AVAILABLE".equals(file.getUploadStatus()))throw invalid("报价图片须为本人上传的有效方案图片");
        });
    }
    private List<String> ids(String raw){return raw==null?List.of():json.readValue(raw,new TypeReference<List<String>>(){});}
    private static Long number(String value){try{return Long.valueOf(value);}catch(NumberFormatException failure){throw invalid("图片编号无效");}}
    private static String normalize(String value){return value==null||value.isBlank()?null:value.strip();}
    private static OffsetDateTime time(LocalDateTime value){return value==null?null:value.atOffset(ZoneOffset.ofHours(8));}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
    private static BusinessException invalid(String reason){return new BusinessException(CommonErrorCode.INVALID_REQUEST,reason);}
    private static BusinessException forbidden(String reason){return new BusinessException(CommonErrorCode.FORBIDDEN,reason);}
    private static BusinessException conflict(String reason){return new BusinessException(CommonErrorCode.CONFLICT,reason);}
}
