package com.handcraft.platform.modules.service;

/** 验证码邮件发送接口，隔离 SMTP 配置与邮件内容。 */
public interface VerificationMailService {

    /** 校验平台发件账号及授权码，未配置时明确拒绝发送。 */
    void requireConfigured();

    /** 通过 SMTP 发送验证码，发送异常交由验证码业务处理。 */
    void send(String email, String code);
}
