package com.handcraft.platform.common.api;

import lombok.Data;

/**
 * 后端接口的统一响应结构。
 *
 * @param <T> 业务数据类型
 */
@Data
public class Result<T> {

    /** 状态码：0 表示成功，非 0 表示失败。 */
    private Integer code;

    /** 提示信息：用于向前端说明本次请求的处理结果。 */
    private String message;

    /** 业务数据：成功时按需返回；校验失败可返回字段错误，其余失败通常为 null。 */
    private T data;

    /**
     * 创建不带业务数据的成功响应。
     *
     * @param <T> 业务数据类型
     * @return 成功响应
     */
    public static <T> Result<T> ok() {
        return ok(null);
    }

    /**
     * 创建带业务数据的成功响应。
     *
     * @param data 业务数据
     * @param <T> 业务数据类型
     * @return 成功响应
     */
    public static <T> Result<T> ok(T data) {
        Result<T> result = new Result<>();
        result.code = 0;
        result.message = "success";
        result.data = data;
        return result;
    }

    /**
     * 创建失败响应。
     *
     * @param code 错误码
     * @param message 面向前端的错误提示
     * @param <T> 业务数据类型
     * @return 失败响应
     */
    public static <T> Result<T> error(Integer code, String message) {
        return error(code, message, null);
    }

    /** 创建带安全错误详情的失败响应，不接收异常对象或原始请求值。 */
    public static <T> Result<T> error(Integer code, String message, T data) {
        Result<T> result = new Result<>();
        result.code = code;
        result.message = message;
        result.data = data;
        return result;
    }
}
