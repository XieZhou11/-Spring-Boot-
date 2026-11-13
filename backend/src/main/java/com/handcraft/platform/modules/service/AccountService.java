package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.PasswordResetDTO;
import com.handcraft.platform.modules.dto.RegistrationDTO;
import com.handcraft.platform.modules.vo.AccountVO;

/** 账号业务接口，统一注册及找回密码的事务入口。 */
public interface AccountService {

    /** 创建账号并在同一事务中消费验证码，成功后不自动登录。 */
    AccountVO register(RegistrationDTO registrationDTO);

    /** 验证邮箱验证码后重置密码，事务提交后撤销旧密码对应的会话。 */
    void resetPassword(PasswordResetDTO passwordResetDTO);
}
