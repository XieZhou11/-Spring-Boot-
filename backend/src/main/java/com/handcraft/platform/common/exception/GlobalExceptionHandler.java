package com.handcraft.platform.common.exception;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.common.api.ValidationErrorData;
import com.handcraft.platform.common.api.ValidationErrorData.FieldViolation;
import com.handcraft.platform.common.logging.SafeLog;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.List;

/** 将控制器层抛出的异常统一转换为 {@link Result} 响应。 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 容器先于业务解析拒绝超大文件时，仍提供一致且可理解的响应。 */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Result<Void>> handleUploadSize(HttpServletRequest request) {
        logFailure(request, 413, 41300, "上传文件过大，头像不能超过 2MB");
        return ResponseEntity.status(413).body(Result.error(41300, "上传文件过大，头像不能超过 2MB"));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Result<Void>> handleBusinessException(
            BusinessException exception, HttpServletRequest request) {
        ErrorCode errorCode = exception.getErrorCode();
        logFailure(request, errorCode.httpStatus().value(), errorCode.code(), exception.getMessage());
        return ResponseEntity.status(errorCode.httpStatus())
                .body(Result.error(errorCode.code(), exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<ValidationErrorData>> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException exception, HttpServletRequest request) {
        return fieldErrors(
                request,
                exception.getBindingResult().getFieldErrors().stream()
                        .map(
                                error ->
                                        new FieldViolation(
                                                error.getField(), validationMessage(error)))
                        .toList());
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<Result<ValidationErrorData>> handleBindException(
            BindException exception, HttpServletRequest request) {
        return fieldErrors(
                request,
                exception.getFieldErrors().stream()
                        .map(
                                error ->
                                        new FieldViolation(
                                                error.getField(), validationMessage(error)))
                        .toList());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Result<ValidationErrorData>> handleConstraintViolationException(
            ConstraintViolationException exception, HttpServletRequest request) {
        return fieldErrors(
                request,
                exception.getConstraintViolations().stream()
                        .map(
                                violation ->
                                        new FieldViolation(
                                                violation.getPropertyPath().toString(),
                                                violation.getMessage()))
                        .toList());
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<?> handleMethodValidation(
            HandlerMethodValidationException exception, HttpServletRequest request) {
        if (exception.isForReturnValue()) {
            LOGGER.error("返回值校验失败：method={}, path={}, status=500, code=50000",
                    request.getMethod(), SafeLog.path(request), SafeLog.exception(exception));
            return ResponseEntity.internalServerError()
                    .body(
                            Result.error(
                                    CommonErrorCode.INTERNAL_ERROR.code(),
                                    CommonErrorCode.INTERNAL_ERROR.message()));
        }
        return fieldErrors(
                request,
                exception.getParameterValidationResults().stream()
                        .flatMap(
                                result ->
                                        result.getResolvableErrors().stream()
                                                .map(
                                                        error ->
                                                                new FieldViolation(
                                                                        result.getMethodParameter()
                                                                                .getParameterName(),
                                                                        error.getDefaultMessage())))
                        .toList());
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Result<Void>> handleAuthentication(HttpServletRequest request) {
        logFailure(request, 401, CommonErrorCode.UNAUTHORIZED.code(), CommonErrorCode.UNAUTHORIZED.message());
        return ResponseEntity.status(401)
                .body(
                        Result.error(
                                CommonErrorCode.UNAUTHORIZED.code(),
                                CommonErrorCode.UNAUTHORIZED.message()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Result<Void>> handleAccessDenied(HttpServletRequest request) {
        logFailure(request, 403, CommonErrorCode.FORBIDDEN.code(), CommonErrorCode.FORBIDDEN.message());
        return ResponseEntity.status(403)
                .body(
                        Result.error(
                                CommonErrorCode.FORBIDDEN.code(),
                                CommonErrorCode.FORBIDDEN.message()));
    }

    private ResponseEntity<Result<ValidationErrorData>> fieldErrors(
            HttpServletRequest request, List<FieldViolation> errors) {
        String message =
                errors.isEmpty()
                        ? CommonErrorCode.INVALID_REQUEST.message()
                        : errors.getFirst().message();
        // 只记录字段名与校验提示，不记录 rejectedValue、DTO 或完整校验异常。
        LOGGER.warn("参数校验失败：method={}, path={}, status=400, code=40000, fields={}",
                request.getMethod(), SafeLog.path(request), errors);
        return ResponseEntity.badRequest()
                .body(
                        Result.error(
                                CommonErrorCode.INVALID_REQUEST.code(),
                                message,
                                new ValidationErrorData(errors)));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Result<Void>> handleHttpMessageNotReadableException(HttpServletRequest request) {
        return invalidRequest(request, "请求体格式错误");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> handleUnexpectedException(
            Exception exception, HttpServletRequest request) {
        // 保留 Spring 定义的 HTTP 状态及 Allow 等响应头，不将请求错误误报成 500。
        if (exception instanceof ErrorResponse errorResponse) {
            return frameworkError(errorResponse, exception, request);
        }
        LOGGER.error("系统处理异常：method={}, path={}, status=500, code=50000",
                request.getMethod(), SafeLog.path(request), SafeLog.exception(exception));
        CommonErrorCode errorCode = CommonErrorCode.INTERNAL_ERROR;
        return ResponseEntity.status(errorCode.httpStatus())
                .body(Result.error(errorCode.code(), errorCode.message()));
    }

    private ResponseEntity<Result<Void>> frameworkError(
            ErrorResponse errorResponse, Exception exception, HttpServletRequest request) {
        int status = errorResponse.getStatusCode().value();
        if (errorResponse.getStatusCode().is5xxServerError()) {
            LOGGER.error("框架处理异常：method={}, path={}, status={}, code={}",
                    request.getMethod(), SafeLog.path(request), status, status * 100,
                    SafeLog.exception(exception));
        }
        String message =
                switch (status) {
                    case 400 -> CommonErrorCode.INVALID_REQUEST.message();
                    case 401 -> CommonErrorCode.UNAUTHORIZED.message();
                    case 403 -> CommonErrorCode.FORBIDDEN.message();
                    case 404 -> CommonErrorCode.NOT_FOUND.message();
                    case 405 -> CommonErrorCode.METHOD_NOT_ALLOWED.message();
                    case 409 -> CommonErrorCode.CONFLICT.message();
                    case 415 -> CommonErrorCode.UNSUPPORTED_MEDIA_TYPE.message();
                    default -> status >= 500 ? CommonErrorCode.INTERNAL_ERROR.message() : "请求无法处理";
                };
        if (!errorResponse.getStatusCode().is5xxServerError()) {
            logFailure(request, status, status * 100, message);
        }
        return ResponseEntity.status(status)
                .headers(errorResponse.getHeaders())
                .body(Result.error(status * 100, message));
    }

    private String validationMessage(FieldError error) {
        // 类型转换错误的默认消息含原始输入和 Java 类型，不能直接返回客户端。
        return error.isBindingFailure()
                ? CommonErrorCode.INVALID_REQUEST.message()
                : error.getDefaultMessage();
    }

    private ResponseEntity<Result<Void>> invalidRequest(HttpServletRequest request, String message) {
        CommonErrorCode errorCode = CommonErrorCode.INVALID_REQUEST;
        logFailure(request, errorCode.httpStatus().value(), errorCode.code(), message);
        return ResponseEntity.status(errorCode.httpStatus())
                .body(Result.error(errorCode.code(), message));
    }

    /** 可预期失败用 WARN 汇总，技术异常在对应边界记录经脱敏的调用栈。 */
    private void logFailure(HttpServletRequest request, int status, int code, String reason) {
        LOGGER.warn("请求处理失败：method={}, path={}, status={}, code={}, reason={}",
                request.getMethod(), SafeLog.path(request), status, code, reason);
    }
}
