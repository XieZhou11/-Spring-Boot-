package com.handcraft.platform.modules.exception;

import com.handcraft.platform.common.exception.ErrorCode;
import org.springframework.http.HttpStatus;

/** 头像错误提示不暴露 OSS 对象键、签名地址或底层异常。 */
public enum AvatarErrorCode implements ErrorCode {
    AVATAR_INVALID(40020, "请选择内容有效的 JPG 或 PNG 图片", HttpStatus.BAD_REQUEST),
    AVATAR_TOO_LARGE(41320, "头像不能超过 2MiB", HttpStatus.PAYLOAD_TOO_LARGE),
    AVATAR_STATE_CONFLICT(40920, "头像上传状态已变化，请重新上传", HttpStatus.CONFLICT),
    AVATAR_STORAGE_UNAVAILABLE(50320, "头像存储服务尚未配置，请联系管理员", HttpStatus.SERVICE_UNAVAILABLE),
    AVATAR_UPLOAD_FAILED(50321, "头像上传失败或结果无法确认，请稍后重试", HttpStatus.SERVICE_UNAVAILABLE);

    private final int code;
    private final String message;
    private final HttpStatus status;
    AvatarErrorCode(int code, String message, HttpStatus status) {
        this.code = code; this.message = message; this.status = status;
    }
    @Override public int code() { return code; }
    @Override public String message() { return message; }
    @Override public HttpStatus httpStatus() { return status; }
}
