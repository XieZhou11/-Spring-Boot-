package com.handcraft.platform.modules.exception;

import com.handcraft.platform.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 评论图片业务错误，不返回对象凭证或SDK异常。 */
public enum CommentImageErrorCode implements ErrorCode {
    INVALID_IMAGE(40050,"请上传完整有效的 JPEG、PNG 或 WebP 图片",HttpStatus.BAD_REQUEST),
    IMAGE_TOO_LARGE(41350,"评论图片不能超过 5MB",HttpStatus.PAYLOAD_TOO_LARGE),
    STORAGE_UNAVAILABLE(50350,"评论图片存储暂不可用，请稍后重试",HttpStatus.SERVICE_UNAVAILABLE),
    STORAGE_FAILED(50351,"评论图片上传结果暂无法确认，请核对后重试",HttpStatus.SERVICE_UNAVAILABLE);
    private final int code;
    private final String message;
    private final HttpStatus status;
    CommentImageErrorCode(int code,String message,HttpStatus status){this.code=code;this.message=message;this.status=status;}
    public int code(){return code;}
    public String message(){return message;}
    public HttpStatus httpStatus(){return status;}
}
