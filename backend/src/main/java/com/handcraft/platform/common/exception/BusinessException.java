package com.handcraft.platform.common.exception;

/**
 * 可预期的业务异常，由全局异常处理器转换为统一失败响应。
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    /**
     * 使用错误码中的默认提示创建业务异常。
     *
     * @param errorCode 错误码
     */
    public BusinessException(ErrorCode errorCode) {
        this(errorCode, errorCode.message());
    }

    /**
     * 使用指定提示创建业务异常。
     *
     * @param errorCode 错误码
     * @param message 面向前端的错误提示
     */
    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    /** @return 本次业务失败对应的错误码 */
    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
