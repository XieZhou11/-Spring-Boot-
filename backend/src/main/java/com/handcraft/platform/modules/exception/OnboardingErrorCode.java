package com.handcraft.platform.modules.exception;

import com.handcraft.platform.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 入驻材料及收款加密错误，不向客户端返回 SDK、密钥或密文信息。 */
public enum OnboardingErrorCode implements ErrorCode {
    INVALID_IMAGE(40030,"请上传完整有效的 JPEG、PNG 或 WebP 图片",HttpStatus.BAD_REQUEST),
    IMAGE_TOO_LARGE(41330,"入驻图片不能超过 5MB",HttpStatus.PAYLOAD_TOO_LARGE),
    STORAGE_UNAVAILABLE(50330,"图片存储暂不可用，请稍后重试",HttpStatus.SERVICE_UNAVAILABLE),
    STORAGE_FAILED(50331,"图片上传结果暂无法确认，请刷新后重试",HttpStatus.SERVICE_UNAVAILABLE),
    PAYMENT_KEY_UNAVAILABLE(50332,"收款资料加密服务暂不可用",HttpStatus.SERVICE_UNAVAILABLE);
    private final int code;
    private final String message;
    private final HttpStatus status;
    OnboardingErrorCode(int code,String message,HttpStatus status){this.code=code;this.message=message;this.status=status;}
    public int code(){return code;}
    public String message(){return message;}
    public HttpStatus httpStatus(){return status;}
}
