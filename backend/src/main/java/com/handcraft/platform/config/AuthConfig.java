package com.handcraft.platform.config;

import com.handcraft.platform.modules.security.AccountAuthenticationProvider;
import com.handcraft.platform.modules.security.AccountSessionRegistry;

import org.springframework.boot.web.servlet.ServletListenerRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

import java.time.Clock;
import java.time.ZoneId;

/** 认证公共组件；业务时间统一按北京时间判断，可在测试中替换时钟。 */
@Configuration
@EnableScheduling
public class AuthConfig {
    @Bean
    Clock businessClock() {
        return Clock.system(ZoneId.of("Asia/Shanghai"));
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    AuthenticationManager authenticationManager(AccountAuthenticationProvider provider) {
        return new ProviderManager(provider);
    }

    @Bean
    ServletListenerRegistrationBean<AccountSessionRegistry> sessionListener(
            AccountSessionRegistry registry) {
        return new ServletListenerRegistrationBean<>(registry);
    }
}
