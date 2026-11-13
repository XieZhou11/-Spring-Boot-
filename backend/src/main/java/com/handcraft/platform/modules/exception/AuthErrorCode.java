package com.handcraft.platform.modules.exception;

import com.handcraft.platform.common.exception.ErrorCode;

import org.springframework.http.HttpStatus;

/** 账号域稳定错误码；内部 SMTP 和数据库错误不得作为提示内容。 */
public enum AuthErrorCode implements ErrorCode {
    INVALID_CODE(40001, "验证码不正确、已使用或已过期，请重新获取。", HttpStatus.BAD_REQUEST),
    EMAIL_NOT_REGISTERED(40002, "该邮箱尚未注册", HttpStatus.BAD_REQUEST),
    INVALID_CREDENTIALS(40101, "邮箱或密码错误", HttpStatus.UNAUTHORIZED),
    EMAIL_REGISTERED(40901, "该邮箱已注册，请登录或通过邮箱找回密码。", HttpStatus.CONFLICT),
    SEND_SUPERSEDED(40902, "已重新获取验证码，请使用最新邮件中的验证码", HttpStatus.CONFLICT),
    MAIL_FAILED(50201, "验证码邮件发送失败，请稍后重试", HttpStatus.BAD_GATEWAY),
    MAIL_NOT_CONFIGURED(50301, "邮箱验证服务尚未配置，请联系管理员", HttpStatus.SERVICE_UNAVAILABLE),
    MAIL_UNKNOWN(50302, "验证码发送或保存结果无法确认，请重新获取", HttpStatus.SERVICE_UNAVAILABLE);

    private final int code;
    private final String message;
    private final HttpStatus status;

    AuthErrorCode(int code, String message, HttpStatus status) {
        this.code = code;
        this.message = message;
        this.status = status;
    }

    @Override
    public int code() {
        return code;
    }

    @Override
    public String message() {
        return message;
    }

    @Override
    public HttpStatus httpStatus() {
        return status;
    }
}
