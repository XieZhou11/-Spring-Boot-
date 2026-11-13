package com.handcraft.platform.config;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.common.exception.CommonErrorCode;
import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.mapper.UserAccountMapper;
import com.handcraft.platform.modules.security.AccountSessionRegistry;
import com.handcraft.platform.modules.security.CredentialSessionFilter;

import jakarta.servlet.DispatcherType;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.util.List;

/** 统一处理跨域、Session 接口访问和 CSRF；业务权限在后续领域任务中细化。 */
@Configuration
public class SecurityConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger(SecurityConfig.class);

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(allowedOrigins);
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Content-Type", "Accept", "X-CSRF-TOKEN", "X-XSRF-TOKEN"));
        cors.setAllowCredentials(true);
        cors.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return source;
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            @Qualifier("corsConfigurationSource") CorsConfigurationSource corsSource,
            ObjectMapper objectMapper,
            UserAccountMapper accounts,
            AccountSessionRegistry sessions,
            Clock clock,
            SecurityContextRepository contexts)
            throws Exception {
        http.cors(cors -> cors.configurationSource(corsSource))
                .securityContext(context -> context.securityContextRepository(contexts))
                .requestCache(AbstractHttpConfigurer::disable)
                .addFilterAfter(
                        new CredentialSessionFilter(accounts, sessions, clock, objectMapper),
                        SecurityContextHolderFilter.class)
                // 保留默认 Session CSRF 校验，前端从 /api/csrf 获取当前会话令牌。
                .authorizeHttpRequests(
                        authorize ->
                                authorize
                                        .dispatcherTypeMatchers(DispatcherType.ERROR)
                                        .permitAll()
                                        .requestMatchers("/api/health", "/api/csrf")
                                        .permitAll()
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/accounts",
                                                "/api/sessions",
                                                "/api/email-verification-codes",
                                                "/api/password-resets")
                                        .permitAll()
                                        .anyRequest()
                                        .authenticated())
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .exceptionHandling(
                        exceptions ->
                                exceptions
                                        .authenticationEntryPoint(
                                                (request, response, exception) -> {
                                                    LOGGER.warn("身份校验失败：method={}, path={}, status=401, code=40100, reason=未登录或登录已失效",
                                                            request.getMethod(), SafeLog.path(request));
                                                    response.setStatus(401);
                                                    response.setContentType(
                                                            MediaType.APPLICATION_JSON_VALUE);
                                                    objectMapper.writeValue(
                                                            response.getOutputStream(),
                                                            Result.error(
                                                                    CommonErrorCode.UNAUTHORIZED
                                                                            .code(),
                                                                    CommonErrorCode.UNAUTHORIZED
                                                                            .message()));
                                                })
                                        .accessDeniedHandler(
                                                (request, response, exception) -> {
                                                    // 不记录异常原文，CSRF 错误可能包含提交的令牌。
                                                    LOGGER.warn("访问被拒绝：method={}, path={}, status=403, code=40300, reason={}",
                                                            request.getMethod(), SafeLog.path(request),
                                                            exception instanceof CsrfException
                                                                    ? "CSRF 令牌缺失或无效，请先获取 /api/csrf 并保持同一 Cookie"
                                                                    : "当前身份无权执行此操作");
                                                    response.setStatus(403);
                                                    response.setContentType(
                                                            MediaType.APPLICATION_JSON_VALUE);
                                                    objectMapper.writeValue(
                                                            response.getOutputStream(),
                                                            Result.error(
                                                                    CommonErrorCode.FORBIDDEN
                                                                            .code(),
                                                                    CommonErrorCode.FORBIDDEN
                                                                            .message()));
                                                }));
        return http.build();
    }
}
