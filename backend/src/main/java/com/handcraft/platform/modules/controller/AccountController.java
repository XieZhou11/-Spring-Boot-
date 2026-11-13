package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.PasswordResetDTO;
import com.handcraft.platform.modules.dto.RegistrationDTO;
import com.handcraft.platform.modules.dto.VerificationCodeDTO;
import com.handcraft.platform.modules.service.AccountService;
import com.handcraft.platform.modules.service.EmailVerificationService;
import com.handcraft.platform.modules.vo.AccountVO;
import com.handcraft.platform.modules.vo.VerificationCodeVO;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 公开的账号创建与邮箱找回入口，仍由安全链校验 CSRF。 */
@RestController
@RequestMapping("/api")
public class AccountController {
    private final AccountService accounts;
    private final EmailVerificationService codes;

    public AccountController(AccountService accounts, EmailVerificationService codes) {
        this.accounts = accounts;
        this.codes = codes;
    }

    /** 申请注册或找回密码共用的验证码，邮件发送及状态保存成功后返回有效期。 */
    @PostMapping("/email-verification-codes")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<VerificationCodeVO> sendCode(@Valid @RequestBody VerificationCodeDTO request) {
        return Result.ok(codes.send(request.getEmail()));
    }

    /** 创建账号，权限及认证字段使用服务端默认值，不自动建立登录会话。 */
    @PostMapping("/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<AccountVO> register(@Valid @RequestBody RegistrationDTO request) {
        return Result.ok(accounts.register(request));
    }

    /** 使用最新验证码重置密码，并在提交后撤销旧密码对应的会话。 */
    @PostMapping("/password-resets")
    public Result<Void> resetPassword(@Valid @RequestBody PasswordResetDTO request) {
        accounts.resetPassword(request);
        return Result.ok();
    }
}
