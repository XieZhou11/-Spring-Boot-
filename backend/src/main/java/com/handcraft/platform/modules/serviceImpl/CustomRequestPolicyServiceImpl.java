package com.handcraft.platform.modules.serviceImpl;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.CustomRequestPolicyService;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
/** 集中保持各入口相同的资格和隐私边界；只读方法不隐式持久化过期。 */
@Service
public class CustomRequestPolicyServiceImpl implements CustomRequestPolicyService {
    private final UserAccountMapper users;private final CreatorApplicationMapper applications;private final CategoryMapper categories;private final CustomRequestMapper requests;private final Clock clock;
    public CustomRequestPolicyServiceImpl(UserAccountMapper users,CreatorApplicationMapper applications,CategoryMapper categories,CustomRequestMapper requests,Clock clock){this.users=users;this.applications=applications;this.categories=categories;this.requests=requests;this.clock=clock;}
    public UserAccount user(Long id){var u=users.findById(id);if(u==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);if(u.isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN,"管理员不能作为交易主体");return u;}
    public void lockUsers(Long... ids){Arrays.stream(ids).filter(Objects::nonNull).distinct().sorted().forEach(users::lockById);}
    public List<Long> mainCategories(UserAccount u){return u.getApprovedApplicationId()==null?List.of():applications.categoryIds(u.getApprovedApplicationId());}
    public String creatorReason(UserAccount u,Long categoryId){
        if(u==null||u.isAdmin()||!"APPROVED".equals(u.getCertificationStatus()))return "需先完成创作者认证";
        if(u.isAdminBusinessPaused())return "账号新业务已暂停";if(u.isCreatorPaused())return "创作者已暂停接单";
        if(categoryId!=null){var c=categories.find(categoryId);var root=c==null?null:c.getParentId()==null?c:categories.find(c.getParentId());if(c==null||!c.isEnabled()||root==null||!root.isEnabled())return "需求品类已停用";if(!mainCategories(u).contains(root.getId()))return "需求品类与创作者认证主品类不匹配";}
        return null;
    }
    public Long lockCategory(Long id){if(id==null)throw invalid("请选择启用的末级品类");var initial=categories.find(id);if(initial==null)throw invalid("品类不存在");if(initial.getParentId()!=null){var p=categories.share(initial.getParentId());if(p==null||!p.isEnabled())throw invalid("品类已停用");}var c=categories.share(id);if(c==null||!c.isEnabled()||categories.all().stream().anyMatch(x->Objects.equals(x.getParentId(),id)))throw invalid("请选择启用的末级品类");return c.getParentId()==null?c.getId():c.getParentId();}
    public String effectiveStatus(CustomRequest r){if(r!=null&&Set.of("OPEN","QUOTING").contains(r.getStatus())){if(requests.effectiveQuotes(r.getId(),now())>0)return "QUOTING";return r.getNoQuoteExpireAt()!=null&&!now().isBefore(r.getNoQuoteExpireAt())?"EXPIRED":"OPEN";}return r==null?null:r.getStatus();}
    public void visible(Long userId,CustomRequest r,boolean ownOnly){var u=user(userId);if(r==null||r.getDeletedAt()!=null)throw missing();if(userId.equals(r.getBuyerId()))return;if(ownOnly||"DRAFT".equals(r.getStatus()))throw missing();if("DIRECTED".equals(r.getVisibility())){if(!userId.equals(r.getInvitedCreatorId()))throw missing();}else if(!"APPROVED".equals(u.getCertificationStatus()))throw missing();}
    public void open(CustomRequest r){if(r==null||r.getDeletedAt()!=null)throw missing();if(!Set.of("OPEN","QUOTING").contains(effectiveStatus(r)))throw new BusinessException(CommonErrorCode.CONFLICT,"需求已关闭、过期或定标，不能开展新咨询");}
    public LocalDateTime now(){return LocalDateTime.ofInstant(clock.instant(),ZoneId.of("Asia/Shanghai"));}
    private static BusinessException invalid(String reason){return new BusinessException(CommonErrorCode.INVALID_REQUEST,reason);}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
}
