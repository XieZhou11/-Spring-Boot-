package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.dto.ProfileUpdateDTO;
import com.handcraft.platform.modules.entity.UserAccount;
import com.handcraft.platform.modules.mapper.UserAccountMapper;
import com.handcraft.platform.modules.service.AvatarService;
import com.handcraft.platform.modules.service.PersonalProfileService;
import com.handcraft.platform.modules.vo.ProfileVO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 公开资料与账号资格隔离，修改昵称不会轮换或延期任何登录会话。 */
@Service
public class PersonalProfileServiceImpl implements PersonalProfileService {
    private static final Logger LOGGER = LoggerFactory.getLogger(PersonalProfileServiceImpl.class);
    private final UserAccountMapper accounts;
    private final AvatarService avatars;

    public PersonalProfileServiceImpl(UserAccountMapper accounts, AvatarService avatars) {
        this.accounts = accounts;
        this.avatars = avatars;
    }

    @Override
    public ProfileVO get(Long userId) {
        LOGGER.info("个人资料查询开始：userId={}", userId);
        try {
            var account = accounts.findById(userId);
            if (account == null) throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
            var result = view(account);
            LOGGER.info("个人资料查询完成：userId={}", userId);
            return result;
        } catch (BusinessException exception) {
            LOGGER.warn("个人资料查询失败：stage=读取本人资料, userId={}, reason={}", userId, exception.getMessage());
            throw exception;
        } catch (RuntimeException exception) {
            LOGGER.error("个人资料查询异常：stage=读取本人资料, userId={}", userId, SafeLog.exception(exception));
            throw exception;
        }
    }

    @Override
    @Transactional(rollbackFor=Exception.class, isolation=Isolation.READ_COMMITTED)
    public ProfileVO update(Long userId, ProfileUpdateDTO input) {
        LOGGER.info("个人资料保存开始：userId={}", userId);
        String stage = "锁定账号";
        try {
            var account = accounts.lockById(userId);
            if (account == null) throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
            stage = "保存昵称和简介";
            if (accounts.updateProfile(userId, input.getNickname(), input.getBio()) != 1)
                throw new IllegalStateException("资料更新未生效");
            account.setNickname(input.getNickname());
            account.setBio(input.getBio());
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { LOGGER.info("个人资料保存完成：userId={}", userId); }
                @Override public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) LOGGER.warn("个人资料保存事务回滚：userId={}", userId);
                    else if (status == STATUS_UNKNOWN) LOGGER.error("个人资料保存提交结果未知：userId={}", userId);
                }
            });
            return view(account);
        } catch (BusinessException exception) {
            LOGGER.warn("个人资料保存失败：stage={}, userId={}, reason={}", stage,userId,exception.getMessage());
            throw exception;
        } catch (RuntimeException exception) {
            LOGGER.error("个人资料保存异常：stage={}, userId={}",stage,userId,SafeLog.exception(exception));
            throw exception;
        }
    }

    private ProfileVO view(UserAccount account) {
        var avatar = avatars.view(account.getId(), account.getAvatarFileId());
        return new ProfileVO(account.getId().toString(),account.getEmail(),account.getNickname(),
                account.getBio() == null ? "" : account.getBio(),
                avatar == null ? null : avatar.url(), avatar == null ? null : avatar.expiresAt());
    }
}
