package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.BusinessException;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.mapper.AdminUserMapper;
import com.handcraft.platform.modules.mapper.UserAccountMapper;
import com.handcraft.platform.modules.service.AdminUserService;
import com.handcraft.platform.modules.vo.*;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 用户管理在账号行锁下校验状态，确保暂停标记与业务资格检查互斥。 */
@Service
public class AdminUserServiceImpl implements AdminUserService {
    private static final Logger LOG=LoggerFactory.getLogger(AdminUserServiceImpl.class);
    private final AdminUserMapper data; private final UserAccountMapper users; private final com.handcraft.platform.modules.service.OperationLogService logs;
    public AdminUserServiceImpl(AdminUserMapper data,UserAccountMapper users,com.handcraft.platform.modules.service.OperationLogService logs){this.data=data;this.users=users;this.logs=logs;}

    @Override public PageVO<Map<String,Object>> list(Long admin,AdminUserQueryDTO q){return BusinessLog.run(LOG,"管理员用户查询",admin,()->{requireAdmin(admin);if(q.getEmail()!=null)q.setEmail(q.getEmail().strip());if(q.getNickname()!=null)q.setNickname(q.getNickname().strip());var items=data.list(q,(q.getPage()-1)*q.getSize());return new PageVO<>(items,data.count(q),q.getPage(),q.getSize());});}
    @Override public AdminUserDetailVO detail(Long admin,Long id){return BusinessLog.run(LOG,"管理员用户详情查询",admin,()->{requireAdmin(admin);var user=data.user(id);if(user==null)throw missing();return new AdminUserDetailVO(user,data.workCount(id),data.requestCount(id),data.orderCount(id),data.works(id),data.requests(id),data.orders(id),data.pauseHistory(id));});}

    @Override @Transactional(rollbackFor=Exception.class)
    public AdminUserBusinessVO setBusinessPause(Long admin,Long id,AdminBusinessPauseDTO input){return BusinessLog.run(LOG,"管理员账号新业务暂停处置",admin,()->{
        requireAdmin(admin);var user=users.lockById(id);if(user==null||user.isAdmin())throw missing();boolean before=user.isAdminBusinessPaused();
        if(input.isPaused()&&(input.getRecoveryCondition()==null||input.getRecoveryCondition().isBlank()))throw new BusinessException(com.handcraft.platform.common.exception.CommonErrorCode.INVALID_REQUEST,"暂停新业务时必须填写恢复条件");
        if(before!=input.isPaused()){if(users.updateAdminBusinessPause(id,input.isPaused())!=1)throw conflict();String from=before?"PAUSED":"ACTIVE",to=input.isPaused()?"PAUSED":"ACTIVE";var facts=new LinkedHashMap<String,Object>();facts.put("creatorPaused",user.isCreatorPaused());facts.put("recoveryCondition",input.getRecoveryCondition());logs.record(admin,true,"USER",id,input.isPaused()?"ADMIN_BUSINESS_PAUSE":"ADMIN_BUSINESS_RESUME",from,to,input.getReason(),facts);LOG.info("管理员账号新业务状态变更已准备：adminId={}, userId={}, from={}, to={}",admin,id,from,to);}
        return new AdminUserBusinessVO(id.toString(),input.isPaused(),user.isCreatorPaused());
    });}

    @Override @Transactional(rollbackFor=Exception.class)
    public AdminUserBusinessVO setCreatorPause(Long id,CreatorPauseDTO input){return BusinessLog.run(LOG,"创作者本人接单暂停设置",id,()->{
        var user=users.lockById(id);if(user==null)throw new BusinessException(com.handcraft.platform.common.exception.CommonErrorCode.UNAUTHORIZED);if(user.isAdmin()||!"APPROVED".equals(user.getCertificationStatus()))throw new BusinessException(com.handcraft.platform.common.exception.CommonErrorCode.FORBIDDEN,"仅认证创作者可以设置接单状态");boolean before=user.isCreatorPaused();
        if(before!=input.isPaused()){if(users.updateCreatorPause(id,input.isPaused())!=1)throw conflict();logs.record(id,false,"USER",id,input.isPaused()?"CREATOR_PAUSE":"CREATOR_RESUME",before?"PAUSED":"ACTIVE",input.isPaused()?"PAUSED":"ACTIVE",null,Map.of("adminBusinessPaused",user.isAdminBusinessPaused()));LOG.info("创作者接单状态变更已准备：userId={}, from={}, to={}",id,before?"PAUSED":"ACTIVE",input.isPaused()?"PAUSED":"ACTIVE");}
        return new AdminUserBusinessVO(id.toString(),user.isAdminBusinessPaused(),input.isPaused());
    });}
    @Override public AdminUserBusinessVO creatorState(Long id){var user=users.findById(id);if(user==null)throw new BusinessException(com.handcraft.platform.common.exception.CommonErrorCode.UNAUTHORIZED);return new AdminUserBusinessVO(id.toString(),user.isAdminBusinessPaused(),user.isCreatorPaused());}
    private void requireAdmin(Long id){var u=users.findById(id);if(u==null||!u.isAdmin())throw new BusinessException(com.handcraft.platform.common.exception.CommonErrorCode.FORBIDDEN,"仅管理员可管理用户");}
    private BusinessException missing(){return new BusinessException(com.handcraft.platform.common.exception.CommonErrorCode.NOT_FOUND,"用户不存在");}
    private BusinessException conflict(){return new BusinessException(com.handcraft.platform.common.exception.CommonErrorCode.CONFLICT,"账号状态已变化，请刷新后重试");}
}
