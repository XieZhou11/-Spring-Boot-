package com.handcraft.platform.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 错误码统一契约，业务域可通过枚举实现该接口扩展自己的错误码。
 */
public interface ErrorCode {

    /** @return 对外返回的业务错误码 */
    int code();

    /** @return 默认错误提示 */
    String message();

    /** @return 对应的 HTTP 状态 */
    HttpStatus httpStatus();
}
