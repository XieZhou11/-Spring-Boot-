package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.BusinessException;
import com.handcraft.platform.modules.exception.AuthErrorCode;
import com.handcraft.platform.modules.service.VerificationMailService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/** 同步调用真实 SMTP，发送状态由上层业务服务持久化。 */
@Service
public class VerificationMailServiceImpl implements VerificationMailService {
    private static final Logger LOGGER = LoggerFactory.getLogger(VerificationMailServiceImpl.class);

    private final JavaMailSender sender;
    private final String username;
    private final String password;

    public VerificationMailServiceImpl(
            JavaMailSender sender,
            @Value("${spring.mail.username:}") String username,
            @Value("${spring.mail.password:}") String password) {
        this.sender = sender;
        this.username = username;
        this.password = password;
    }

    @Override
    public void requireConfigured() {
        if (username.isBlank() || password.isBlank()) {
            LOGGER.warn("SMTP 配置缺失：请检查 spring.mail.username 与 spring.mail.password（SMTP 授权码），本次发送已拒绝");
            throw new BusinessException(AuthErrorCode.MAIL_NOT_CONFIGURED);
        }
    }

    @Override
    public void send(String email, String code) {
        requireConfigured();
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(username);
        message.setTo(email);
        message.setSubject("手工定制作品平台邮箱验证码");
        message.setText("您的验证码为：" + code + "，5 分钟内有效。注册与找回密码共用此验证码，请勿向他人泄露。");
        sender.send(message);
    }
}
