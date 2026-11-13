package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.vo.VerificationCodeVO;

/** 邮箱验证码业务接口，注册和找回密码共用最新一条验证码。 */
public interface EmailVerificationService {

    /** 发送真实邮件并保存发送结果，只有明确发送及保存成功才返回有效期。 */
    VerificationCodeVO send(String email);

    /** 在调用方的账号事务内校验并单次消费验证码，失败时抛出业务异常。 */
    void consume(String email, String code);
}
