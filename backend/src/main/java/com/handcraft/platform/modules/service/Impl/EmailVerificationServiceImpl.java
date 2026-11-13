package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.BusinessException;
import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.entity.EmailVerificationCode;
import com.handcraft.platform.modules.exception.AuthErrorCode;
import com.handcraft.platform.modules.mapper.EmailVerificationCodeMapper;
import com.handcraft.platform.modules.service.EmailVerificationService;
import com.handcraft.platform.modules.service.VerificationMailService;
import com.handcraft.platform.modules.vo.VerificationCodeVO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSendException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** 发送与数据库分段处理，SMTP 不占用数据库行锁；成功消费必须加入账号事务。 */
@Service
public class EmailVerificationServiceImpl implements EmailVerificationService {
    private static final Logger LOGGER = LoggerFactory.getLogger(EmailVerificationServiceImpl.class);

    private final EmailVerificationCodeMapper mapper;
    private final VerificationMailService mail;
    private final Clock clock;
    private final byte[] secret;
    private final SecureRandom random = new SecureRandom();
    private final TransactionTemplate transaction;

    public EmailVerificationServiceImpl(
            EmailVerificationCodeMapper mapper,
            VerificationMailService mail,
            Clock clock,
            @Value("${app.auth.verification-secret:}") String secret,
            PlatformTransactionManager manager) {
        this.mapper = mapper;
        this.mail = mail;
        this.clock = clock;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.transaction = new TransactionTemplate(manager);
        this.transaction.setIsolationLevel(
                org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    @Override
    public VerificationCodeVO send(String email) {
        mail.requireConfigured();
        requireSecret();
        EmailVerificationCode record = new EmailVerificationCode();
        record.setEmail(email);
        record.setSendRequestKey(UUID.randomUUID().toString());
        record.setExpiresAt(LocalDateTime.now(clock).plusMinutes(5));
        record.setCodeDigest(new byte[32]);
        LOGGER.info("验证码发送开始：sendRequestKey={}, email={}",
                record.getSendRequestKey(), SafeLog.email(email));
        String code;
        try {
            code = transaction.execute(
                        status -> {
                            // 先确保并锁定唯一邮箱行，再读取旧摘要；不存在记录时也不产生并发空隙。
                            mapper.ensureRow(record);
                            var previous = mapper.lockByEmail(email);
                            String candidate;
                            byte[] digest;
                            // 避免重发偶然生成相同六位数字，导致用户无法区分旧码和新码。
                            do {
                                candidate =
                                        String.format(
                                                java.util.Locale.ROOT,
                                                "%06d",
                                                random.nextInt(1_000_000));
                                digest = digest(email, candidate);
                            } while (previous != null
                                    && MessageDigest.isEqual(previous.getCodeDigest(), digest));
                            record.setCodeDigest(digest);
                            mapper.reserve(record);
                            return candidate;
                        });
        } catch (RuntimeException exception) {
            // 覆盖预留语句及事务提交失败；此阶段尚未调用 SMTP，保留原异常语义。
            LOGGER.error("验证码预留失败：sendRequestKey={}, email={}, outcome=RESERVATION_FAILED, smtpOutcome=SMTP_NOT_ATTEMPTED",
                    record.getSendRequestKey(), SafeLog.email(email), SafeLog.exception(exception));
            throw exception;
        }

        String outcome = "SENT";
        AuthErrorCode failure = null;
        try {
            mail.send(email, code);
        } catch (MailAuthenticationException exception) {
            outcome = "FAILED";
            failure = AuthErrorCode.MAIL_FAILED;
            LOGGER.warn("验证码 SMTP 认证失败：sendRequestKey={}, email={}, outcome=FAILED；请检查发件账号、SMTP 授权码及服务开关",
                    record.getSendRequestKey(), SafeLog.email(email), SafeLog.exception(exception));
        } catch (MailException exception) {
            // 传输异常可能发生在服务器已接收之后，不能推断邮件一定未发送。
            outcome = "UNKNOWN";
            failure = AuthErrorCode.MAIL_UNKNOWN;
            LOGGER.warn("验证码 SMTP 传输异常：sendRequestKey={}, email={}, outcome=UNKNOWN；请检查网络、端口与 SSL 配置，邮件可能已被接收",
                    record.getSendRequestKey(), SafeLog.email(email), SafeLog.exception(mailCause(exception)));
        }
        try {
            if (mapper.finish(email, record.getSendRequestKey(), outcome) != 1) {
                LOGGER.warn("验证码发送已被新请求替代：sendRequestKey={}, email={}, smtpOutcome={}",
                        record.getSendRequestKey(), SafeLog.email(email), outcome);
                throw new BusinessException(AuthErrorCode.SEND_SUPERSEDED);
            }
        } catch (DataAccessException exception) {
            // 保留 SENDING 时验证码不可消费；不得在 SMTP 已执行后宣称整体成功。
            LOGGER.error("验证码发送状态回写失败：sendRequestKey={}, email={}, smtpOutcome={}, outcome=UNKNOWN",
                    record.getSendRequestKey(), SafeLog.email(email), outcome, SafeLog.exception(exception));
            throw new BusinessException(AuthErrorCode.MAIL_UNKNOWN);
        }
        if (failure != null) {
            throw new BusinessException(failure);
        }
        LOGGER.info("验证码发送完成：sendRequestKey={}, email={}, outcome=SENT, expiresAt={}",
                record.getSendRequestKey(), SafeLog.email(email), record.getExpiresAt());
        return new VerificationCodeVO(
                record.getExpiresAt().atZone(clock.getZone()).toOffsetDateTime());
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY, rollbackFor = Exception.class)
    public void consume(String email, String code) {
        LOGGER.info("验证码核验开始：email={}", SafeLog.email(email));
        requireSecret();
        EmailVerificationCode record = mapper.lockByEmail(email);
        LocalDateTime now = LocalDateTime.now(clock);
        // 各分支保留原有短路次序；具体原因只写服务端，前端继续使用统一验证码错误。
        String reason = null;
        if (record == null) {
            reason = "未找到验证码记录";
        } else if (!"SENT".equals(record.getSendStatus())) {
            reason = "验证码邮件尚未确认发送成功";
        } else if (record.getUsedAt() != null) {
            reason = "验证码已使用";
        } else if (!now.isBefore(record.getExpiresAt())) {
            reason = "验证码已过期";
        } else if (!MessageDigest.isEqual(record.getCodeDigest(), digest(email, code))) {
            reason = "验证码不匹配";
        } else if (mapper.consume(email, record.getSendRequestKey(), now) != 1) {
            reason = "验证码消费未生效，记录可能已变更";
        }
        if (reason != null) {
            LOGGER.warn("验证码核验失败：email={}, sendRequestKey={}, code={}, reason={}",
                    SafeLog.email(email), record == null ? "-" : record.getSendRequestKey(),
                    AuthErrorCode.INVALID_CODE.code(), reason);
            throw new BusinessException(AuthErrorCode.INVALID_CODE);
        }
        // 验证通过仅表示当前事务内的消费成功，最终结果随账号事务提交或回滚。
        LOGGER.info("验证码核验通过，消费等待业务事务提交：email={}, sendRequestKey={}",
                SafeLog.email(email), record.getSendRequestKey());
    }

    private void requireSecret() {
        if (secret.length < 32) {
            LOGGER.warn("验证码配置缺失：app.auth.verification-secret 必须为至少 32 字节的稳定随机密钥；本次操作已拒绝");
            throw new BusinessException(AuthErrorCode.MAIL_NOT_CONFIGURED);
        }
    }

    /** JavaMail 有时把传输异常放在失败邮件映射中，仅提取异常，禁止打印邮件对象。 */
    private Throwable mailCause(MailException exception) {
        if (exception.getCause() == null && exception instanceof MailSendException sendException
                && sendException.getMessageExceptions().length > 0) {
            return sendException.getMessageExceptions()[0];
        }
        return exception;
    }

    private byte[] digest(String email, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal((email + "\0" + code).getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("无法计算验证码摘要", exception);
        }
    }
}
