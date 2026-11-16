package com.handcraft.platform.modules.security;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.common.exception.CommonErrorCode;
import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.mapper.UserAccountMapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Clock;

/** 每次认证请求核对绝对截止时间和持久化密码指纹，防止重置与登录交错漏撤销。 */
public class CredentialSessionFilter extends OncePerRequestFilter {
    private static final Logger LOGGER = LoggerFactory.getLogger(CredentialSessionFilter.class);

    private final UserAccountMapper accounts;
    private final AccountSessionRegistry sessions;
    private final Clock clock;
    private final ObjectMapper json;

    public CredentialSessionFilter(
            UserAccountMapper accounts,
            AccountSessionRegistry sessions,
            Clock clock,
            ObjectMapper json) {
        this.accounts = accounts;
        this.sessions = sessions;
        this.clock = clock;
        this.json = json;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.getPrincipal() instanceof AccountPrincipal principal) {
            String invalidReason = null;
            try {
                var account = accounts.findById(principal.userId());
                if (!clock.instant().isBefore(principal.expiresAt())) {
                    invalidReason = "登录超过绝对有效期";
                } else if (account == null) {
                    invalidReason = "账号已不存在";
                } else if (!principal.matches(account.getPasswordHash())) {
                    invalidReason = "密码已变更，旧登录凭证失效";
                } else {
                    // 认证或管理员资格变化在旧会话立即生效，避免依赖登录时的权限快照。
                    principal.reconcile(account);
                    var refreshed = org.springframework.security.authentication.UsernamePasswordAuthenticationToken.authenticated(
                            principal,null,AccountPrincipal.roles(account).stream()
                                    .map(role->new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_"+role)).toList());
                    var context=SecurityContextHolder.createEmptyContext();
                    context.setAuthentication(refreshed);
                    SecurityContextHolder.setContext(context);
                }
            } catch (DataAccessException exception) {
                // 数据库不可用时拒绝本次访问，不能依赖缓存身份继续放行。
                LOGGER.error("登录凭证数据库校验失败：method={}, path={}, status=500, code=50000",
                        request.getMethod(), SafeLog.path(request), SafeLog.exception(exception));
                writeError(response, CommonErrorCode.INTERNAL_ERROR);
                return;
            }
            if (invalidReason != null) {
                sessions.invalidate(request.getSession(false));
                SecurityContextHolder.clearContext();
                LOGGER.warn("登录凭证失效：method={}, path={}, status=401, code=40100, reason={}",
                        request.getMethod(), SafeLog.path(request), invalidReason);
                writeError(response, CommonErrorCode.UNAUTHORIZED);
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private void writeError(HttpServletResponse response, CommonErrorCode error)
            throws IOException {
        response.setStatus(error.httpStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        json.writeValue(response.getOutputStream(), Result.error(error.code(), error.message()));
    }
}
