package com.handcraft.platform.modules.security;

import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.mapper.UserAccountMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Clock;

/** 邮箱密码认证提供器；两个暂停标记不属于登录封禁条件。 */
@Component
public class AccountAuthenticationProvider implements AuthenticationProvider {
    private static final Logger LOGGER = LoggerFactory.getLogger(AccountAuthenticationProvider.class);

    private final UserAccountMapper accounts;
    private final PasswordEncoder passwords;
    private final Clock clock;
    private final String dummyHash;

    public AccountAuthenticationProvider(
            UserAccountMapper accounts, PasswordEncoder passwords, Clock clock) {
        this.accounts = accounts;
        this.passwords = passwords;
        this.clock = clock;
        this.dummyHash = passwords.encode("unavailable-account-password");
    }

    @Override
    public Authentication authenticate(Authentication authentication) {
        var account = accounts.findByEmail(authentication.getName());
        String password = authentication.getCredentials() instanceof String value ? value : "";
        boolean matches =
                passwords.matches(
                        password, account == null ? dummyHash : account.getPasswordHash());
        if (account == null || !matches) {
            // 前端继续使用统一提示，服务端记录具体拒绝原因，且不回显邮箱用户名和密码。
            LOGGER.warn("登录凭证校验失败：email={}, reason={}", SafeLog.email(authentication.getName()),
                    account == null ? "邮箱未注册" : "密码不匹配");
            throw new BadCredentialsException("邮箱或密码错误");
        }
        var authorities =
                AccountPrincipal.roles(account).stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                        .toList();
        return UsernamePasswordAuthenticationToken.authenticated(
                new AccountPrincipal(account, clock.instant()), null, authorities);
    }

    @Override
    public boolean supports(Class<?> type) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(type);
    }
}
