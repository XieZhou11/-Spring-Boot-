package com.handcraft.platform.common.logging;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.web.servlet.HandlerMapping;

import java.util.Locale;
import java.util.Set;

/** 日志只保留定位信息，避免请求输入、邮件正文和数据库异常消息泄露敏感资料。 */
public final class SafeLog {
    // 安全链早于 MVC，只允许回退到已知静态接口；其他路径可能含用户输入或凭据。
    private static final Set<String> STATIC_PATHS = Set.of(
            "/api/health", "/api/csrf", "/api/accounts", "/api/sessions",
            "/api/sessions/current", "/api/email-verification-codes", "/api/password-resets");

    private SafeLog() {}

    /** 优先记录路由模板，不读取查询串、请求体、Cookie 或认证头。 */
    public static String path(HttpServletRequest request) {
        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        String path = pattern == null ? request.getRequestURI() : pattern.toString();
        if (path == null) {
            return "-";
        }
        // 容器允许在路径附加 ;jsessionid，记录路径时一并去除矩阵参数。
        String safe = path.replaceAll(";[^/]*", "").replaceAll("[\\p{Cntrl}]", "_");
        if (pattern == null && !STATIC_PATHS.contains(safe)) {
            return "<未匹配路由>";
        }
        return safe.substring(0, Math.min(safe.length(), 512));
    }

    /** 邮箱只显示受支持的域名，不输出可识别个人的用户名。 */
    public static String email(String email) {
        if (email == null) {
            return "***";
        }
        String domain = email.substring(email.lastIndexOf('@') + 1).toLowerCase(Locale.ROOT);
        return "qq.com".equals(domain) || "163.com".equals(domain) ? "***@" + domain : "***";
    }

    /** 保留异常类型、调用栈和因果链；原始异常消息可能含 SQL 参数、验证码或授权码。 */
    public static Throwable exception(Throwable source) {
        return exception(source, 0);
    }

    private static Throwable exception(Throwable source, int depth) {
        if (source == null || depth >= 8) {
            return null;
        }
        var safe = new RuntimeException(source.getClass().getName());
        safe.setStackTrace(source.getStackTrace());
        safe.initCause(exception(source.getCause(), depth + 1));
        // 不复制 suppressed 或异常自带的邮件对象，避免其 toString 回显正文。
        return safe;
    }
}
