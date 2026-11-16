package com.handcraft.platform.modules.exception;
import com.handcraft.platform.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;
/** 作品图片失败使用业务提示，不暴露SDK或对象凭证。 */
public enum WorkImageErrorCode implements ErrorCode {
    INVALID_IMAGE(40040,"请上传完整有效的 JPEG、PNG 或 WebP 图片",HttpStatus.BAD_REQUEST),
    IMAGE_TOO_LARGE(41340,"作品图片不能超过 5MB",HttpStatus.PAYLOAD_TOO_LARGE),
    STORAGE_UNAVAILABLE(50340,"图片存储暂不可用，请稍后重试",HttpStatus.SERVICE_UNAVAILABLE),
    STORAGE_FAILED(50341,"图片上传结果暂无法确认，请刷新后重试",HttpStatus.SERVICE_UNAVAILABLE);
    private final int code;private final String message;private final HttpStatus status;
    WorkImageErrorCode(int code,String message,HttpStatus status){this.code=code;this.message=message;this.status=status;}
    public int code(){return code;}public String message(){return message;}public HttpStatus httpStatus(){return status;}
}
