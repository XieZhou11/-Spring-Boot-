package com.handcraft.platform.common.api;

import java.util.List;

/** 字段校验失败只返回字段名和原因，不包含被拒绝的原始输入。 */
public record ValidationErrorData(List<FieldViolation> fieldErrors) {
    public record FieldViolation(String field, String message) {}
}
