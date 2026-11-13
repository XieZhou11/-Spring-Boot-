package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.BusinessException;
import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.dto.PasswordResetDTO;
import com.handcraft.platform.modules.dto.RegistrationDTO;
import com.handcraft.platform.modules.entity.UserAccount;
import com.handcraft.platform.modules.exception.AuthErrorCode;
import com.handcraft.platform.modules.mapper.UserAccountMapper;
import com.handcraft.platform.modules.security.AccountSessionRegistry;
import com.handcraft.platform.modules.service.AccountService;
import com.handcraft.platform.modules.service.EmailVerificationService;
import com.handcraft.platform.modules.vo.AccountVO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** 账号与验证码变更必须同事务；会话撤销仅在密码事务提交后进行。 */
@Service
public class AccountServiceImpl implements AccountService {
    private static final Logger LOGGER = LoggerFactory.getLogger(AccountServiceImpl.class);

    private final UserAccountMapper accounts;
    private final EmailVerificationService codes;
    private final PasswordEncoder passwords;
    private final AccountSessionRegistry sessions;

    public AccountServiceImpl(
            UserAccountMapper accounts,
            EmailVerificationService codes,
            PasswordEncoder passwords,
            AccountSessionRegistry sessions) {
        this.accounts = accounts;
        this.codes = codes;
        this.passwords = passwords;
        this.sessions = sessions;
    }

    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public AccountVO register(RegistrationDTO request) {
        LOGGER.info("账号注册开始：email={}", SafeLog.email(request.getEmail()));
        String stage = "检查邮箱";
        try {
            if (accounts.findByEmail(request.getEmail()) != null) {
                throw new BusinessException(AuthErrorCode.EMAIL_REGISTERED);
            }
            stage = "校验验证码";
            codes.consume(request.getEmail(), request.getVerificationCode());
            stage = "生成密码摘要";
            UserAccount account = new UserAccount();
            account.setEmail(request.getEmail());
            account.setNickname(request.getNickname());
            account.setPasswordHash(passwords.encode(request.getPassword()));
            stage = "写入账号";
            try {
                if (accounts.insert(account) != 1) {
                    throw new IllegalStateException("账号创建未生效");
                }
            } catch (DuplicateKeyException exception) {
                // 本插入仅提供邮箱这一项可冲突的唯一字段；消费随账号事务一起回滚。
                throw new BusinessException(AuthErrorCode.EMAIL_REGISTERED);
            }
            LOGGER.info("账号注册已写入，等待事务提交：userId={}", account.getId());
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            // 方法返回不代表事务提交，成功日志必须放在提交回调中。
                            LOGGER.info("账号注册成功：userId={}", account.getId());
                        }

                        @Override
                        public void afterCompletion(int status) {
                            if (status == STATUS_ROLLED_BACK) {
                                LOGGER.warn("账号注册事务已回滚：userId={}", account.getId());
                            } else if (status == STATUS_UNKNOWN) {
                                LOGGER.error("账号注册提交结果无法确认：userId={}，请核对数据库账号记录",
                                        account.getId());
                            }
                        }
                    });
            return new AccountVO(account.getId().toString(), account.getEmail(), account.getNickname());
        } catch (BusinessException exception) {
            LOGGER.warn("账号注册失败：stage={}, email={}, code={}, reason={}",
                    stage, SafeLog.email(request.getEmail()), exception.getErrorCode().code(), exception.getMessage());
            throw exception;
        } catch (RuntimeException exception) {
            LOGGER.error("账号注册异常：stage={}, email={}，账号及验证码变更将回滚",
                    stage, SafeLog.email(request.getEmail()), SafeLog.exception(exception));
            throw exception;
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public void resetPassword(PasswordResetDTO request) {
        LOGGER.info("密码重置开始：email={}", SafeLog.email(request.getEmail()));
        String stage = "检查并锁定账号";
        try {
            // 已有用户先锁账号再锁验证码，与全局已有行锁顺序保持一致。
            UserAccount account = accounts.lockByEmail(request.getEmail());
            if (account == null) {
                throw new BusinessException(AuthErrorCode.EMAIL_NOT_REGISTERED);
            }
            stage = "校验验证码";
            codes.consume(request.getEmail(), request.getVerificationCode());
            stage = "生成密码摘要";
            String hash = passwords.encode(request.getNewPassword());
            stage = "更新密码";
            if (accounts.updatePassword(account.getId(), hash) != 1) {
                throw new IllegalStateException("密码更新未生效");
            }
            LOGGER.info("密码重置已写入，等待事务提交：userId={}", account.getId());
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            LOGGER.info("密码重置成功：userId={}", account.getId());
                            // 只撤销本次重置前的凭证；较早回调不能撤销后来密码对应的新登录。
                            try {
                                sessions.revokeCredentials(account.getId(), account.getPasswordHash());
                                LOGGER.info("密码重置后旧登录凭证撤销完成：userId={}", account.getId());
                            } catch (RuntimeException exception) {
                                LOGGER.error("密码已提交但旧登录凭证撤销异常：userId={}，后续请求仍会核对密码指纹",
                                        account.getId(), SafeLog.exception(exception));
                                throw exception;
                            }
                        }

                        @Override
                        public void afterCompletion(int status) {
                            if (status == STATUS_ROLLED_BACK) {
                                LOGGER.warn("密码重置事务已回滚：userId={}", account.getId());
                            } else if (status == STATUS_UNKNOWN) {
                                LOGGER.error("密码重置提交结果无法确认：userId={}，请核对数据库状态与登录凭证",
                                        account.getId());
                            }
                        }
                    });
        } catch (BusinessException exception) {
            LOGGER.warn("密码重置失败：stage={}, email={}, code={}, reason={}",
                    stage, SafeLog.email(request.getEmail()), exception.getErrorCode().code(), exception.getMessage());
            throw exception;
        } catch (RuntimeException exception) {
            LOGGER.error("密码重置异常：stage={}, email={}，密码及验证码变更将回滚",
                    stage, SafeLog.email(request.getEmail()), SafeLog.exception(exception));
            throw exception;
        }
    }
}
