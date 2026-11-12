package com.handcraft.platform.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 与具体业务域无关的通用错误码。
 */
public enum CommonErrorCode implements ErrorCode {

    INVALID_REQUEST(40000, "请求参数错误", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(40100, "未登录或登录已失效", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(40300, "无权执行此操作", HttpStatus.FORBIDDEN),
    NOT_FOUND(40400, "请求的资源不存在", HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(40500, "请求方法不支持", HttpStatus.METHOD_NOT_ALLOWED),
    CONFLICT(40900, "当前状态不允许执行此操作", HttpStatus.CONFLICT),
    UNSUPPORTED_MEDIA_TYPE(41500, "请求内容类型不支持", HttpStatus.UNSUPPORTED_MEDIA_TYPE),
    INTERNAL_ERROR(50000, "系统内部错误", HttpStatus.INTERNAL_SERVER_ERROR);

    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    CommonErrorCode(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
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
        return httpStatus;
    }
}
