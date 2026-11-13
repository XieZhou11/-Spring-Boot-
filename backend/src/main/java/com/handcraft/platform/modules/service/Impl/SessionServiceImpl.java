package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.BusinessException;
import com.handcraft.platform.common.exception.CommonErrorCode;
import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.dto.LoginDTO;
import com.handcraft.platform.modules.exception.AuthErrorCode;
import com.handcraft.platform.modules.mapper.UserAccountMapper;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.security.AccountSessionRegistry;
import com.handcraft.platform.modules.service.SessionService;
import com.handcraft.platform.modules.vo.SessionVO;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.stereotype.Service;

import java.time.ZoneId;

/** 负责 JSON 登录与 Servlet 会话桥接，显式保存 SecurityContext。 */
@Service
public class SessionServiceImpl implements SessionService {
    private static final Logger LOGGER = LoggerFactory.getLogger(SessionServiceImpl.class);

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contexts;
    private final AccountSessionRegistry sessions;
    private final UserAccountMapper accounts;

    public SessionServiceImpl(
            AuthenticationManager authenticationManager,
            SecurityContextRepository contexts,
            AccountSessionRegistry sessions,
            UserAccountMapper accounts) {
        this.authenticationManager = authenticationManager;
        this.contexts = contexts;
        this.sessions = sessions;
        this.accounts = accounts;
    }

    @Override
    public SessionVO login(
            LoginDTO input, HttpServletRequest request, HttpServletResponse response) {
        LOGGER.info("账号登录开始：email={}", SafeLog.email(input.getEmail()));
        String stage = "身份认证";
        try {
            Authentication authentication =
                    authenticationManager.authenticate(
                            UsernamePasswordAuthenticationToken.unauthenticated(
                                    input.getEmail(), input.getPassword()));
            AccountPrincipal principal = (AccountPrincipal) authentication.getPrincipal();
            LOGGER.info("账号登录身份认证通过：userId={}", principal.userId());
            stage = "再次核对登录凭证";
            // 先读取视图并再次核对摘要，拒绝认证过程中已经完成的密码重置。
            SessionVO view = current(principal);
            stage = "建立登录会话";
            // 每次登录使用新的会话对象，隔离旧账号属性及并发撤销，不能仅轮换旧对象 ID。
            sessions.invalidate(request.getSession(false));
            request.getSession(true);
            new HttpSessionCsrfTokenRepository().saveToken(null, request, response);
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            contexts.saveContext(context, request, response);
            var session = request.getSession(true);
            session.setMaxInactiveInterval(7 * 24 * 60 * 60);
            sessions.register(session, principal);
            // 会话编号和凭证指纹属于敏感信息，只记录内部用户编号及截止时间。
            LOGGER.info("账号登录成功：userId={}, activeRole={}, expiresAt={}",
                    principal.userId(), principal.activeRole(), principal.expiresAt());
            return view;
        } catch (AuthenticationException exception) {
            LOGGER.warn("账号登录失败：stage={}, email={}, code={}, reason=邮箱或密码错误, exceptionType={}",
                    stage, SafeLog.email(input.getEmail()), AuthErrorCode.INVALID_CREDENTIALS.code(),
                    exception.getClass().getSimpleName());
            throw new BusinessException(AuthErrorCode.INVALID_CREDENTIALS);
        } catch (BusinessException exception) {
            LOGGER.warn("账号登录失败：stage={}, email={}, code={}, reason={}",
                    stage, SafeLog.email(input.getEmail()), exception.getErrorCode().code(), exception.getMessage());
            throw exception;
        } catch (RuntimeException exception) {
            LOGGER.error("账号登录异常：stage={}, email={}",
                    stage, SafeLog.email(input.getEmail()), SafeLog.exception(exception));
            throw exception;
        }
    }

    @Override
    public SessionVO current(AccountPrincipal principal) {
        if (principal == null) {
            LOGGER.warn("当前会话查询失败：code=40100, reason=缺少登录身份");
            throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        }
        try {
            var account = accounts.findById(principal.userId());
            if (account == null || !principal.matches(account.getPasswordHash())) {
                LOGGER.warn("当前会话查询失败：userId={}, code=40100, reason={}",
                        principal.userId(), account == null ? "账号不存在" : "密码已变更，旧登录凭证失效");
                throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
            }
            LOGGER.info("当前会话查询成功：userId={}", account.getId());
            return new SessionVO(
                    account.getId().toString(),
                    account.getEmail(),
                    account.getNickname(),
                    AccountPrincipal.roles(account),
                    principal.activeRole(),
                    principal.expiresAt().atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime());
        } catch (BusinessException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            LOGGER.error("当前会话查询异常：stage=读取账号, userId={}",
                    principal.userId(), SafeLog.exception(exception));
            throw exception;
        }
    }

    @Override
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        Long userId = authentication != null && authentication.getPrincipal() instanceof AccountPrincipal principal
                ? principal.userId() : null;
        LOGGER.info("账号退出开始：userId={}", userId);
        String stage = "撤销当前会话";
        try {
            sessions.invalidate(request.getSession(false));
            SecurityContextHolder.clearContext();
            stage = "清除会话 Cookie";
            Cookie cookie = new Cookie("JSESSIONID", "");
            cookie.setHttpOnly(true);
            cookie.setSecure(request.isSecure());
            cookie.setPath(request.getContextPath().isEmpty() ? "/" : request.getContextPath());
            cookie.setMaxAge(0);
            cookie.setAttribute("SameSite", "Lax");
            response.addCookie(cookie);
            LOGGER.info("账号退出成功：userId={}", userId);
        } catch (RuntimeException exception) {
            LOGGER.error("账号退出异常：stage={}, userId={}", stage, userId, SafeLog.exception(exception));
            throw exception;
        }
    }
}
