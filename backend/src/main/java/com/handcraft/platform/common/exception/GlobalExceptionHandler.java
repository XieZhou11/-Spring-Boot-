package com.handcraft.platform.common.exception;

import com.handcraft.platform.common.api.Result;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 将控制器层抛出的异常统一转换为 {@link Result} 响应。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Result<Void>> handleBusinessException(BusinessException exception) {
        ErrorCode errorCode = exception.getErrorCode();
        return ResponseEntity.status(errorCode.httpStatus())
                .body(Result.error(errorCode.code(), exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<Void>> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(this::validationMessage)
                .orElse(CommonErrorCode.INVALID_REQUEST.message());
        return invalidRequest(message);
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<Result<Void>> handleBindException(BindException exception) {
        String message = exception.getFieldErrors().stream()
                .findFirst()
                .map(this::validationMessage)
                .orElse(CommonErrorCode.INVALID_REQUEST.message());
        return invalidRequest(message);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Result<Void>> handleConstraintViolationException(
            ConstraintViolationException exception) {
        String message = exception.getConstraintViolations().stream()
                .findFirst()
                .map(violation -> violation.getMessage())
                .orElse(CommonErrorCode.INVALID_REQUEST.message());
        return invalidRequest(message);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Result<Void>> handleHttpMessageNotReadableException() {
        return invalidRequest("请求体格式错误");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> handleUnexpectedException(Exception exception) {
        // 保留 Spring 定义的 HTTP 状态及 Allow 等响应头，不将请求错误误报成 500。
        if (exception instanceof ErrorResponse errorResponse) {
            return frameworkError(errorResponse, exception);
        }
        LOGGER.error("Unhandled exception", exception);
        CommonErrorCode errorCode = CommonErrorCode.INTERNAL_ERROR;
        return ResponseEntity.status(errorCode.httpStatus())
                .body(Result.error(errorCode.code(), errorCode.message()));
    }

    private ResponseEntity<Result<Void>> frameworkError(ErrorResponse errorResponse, Exception exception) {
        int status = errorResponse.getStatusCode().value();
        if (errorResponse.getStatusCode().is5xxServerError()) {
            LOGGER.error("Framework exception", exception);
        }
        String message = switch (status) {
            case 400 -> CommonErrorCode.INVALID_REQUEST.message();
            case 401 -> CommonErrorCode.UNAUTHORIZED.message();
            case 403 -> CommonErrorCode.FORBIDDEN.message();
            case 404 -> CommonErrorCode.NOT_FOUND.message();
            case 405 -> CommonErrorCode.METHOD_NOT_ALLOWED.message();
            case 409 -> CommonErrorCode.CONFLICT.message();
            case 415 -> CommonErrorCode.UNSUPPORTED_MEDIA_TYPE.message();
            default -> status >= 500 ? CommonErrorCode.INTERNAL_ERROR.message() : "请求无法处理";
        };
        return ResponseEntity.status(status)
                .headers(errorResponse.getHeaders())
                .body(Result.error(status * 100, message));
    }

    private String validationMessage(FieldError error) {
        // 类型转换错误的默认消息含原始输入和 Java 类型，不能直接返回客户端。
        return error.isBindingFailure() ? CommonErrorCode.INVALID_REQUEST.message() : error.getDefaultMessage();
    }

    private ResponseEntity<Result<Void>> invalidRequest(String message) {
        CommonErrorCode errorCode = CommonErrorCode.INVALID_REQUEST;
        return ResponseEntity.status(errorCode.httpStatus())
                .body(Result.error(errorCode.code(), message));
    }
}
