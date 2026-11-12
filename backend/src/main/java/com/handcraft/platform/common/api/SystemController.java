package com.handcraft.platform.common.api;

import java.util.Map;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 框架联调入口，不提供业务数据或外部服务可用性承诺。 */
@RestController
@RequestMapping("/api")
public class SystemController {

    @GetMapping("/health")
    public Result<Map<String, String>> health() {
        return Result.ok(Map.of("status", "UP"));
    }

    /** 读取令牌时创建会话，供携带 Cookie 的前端写请求使用。 */
    @GetMapping("/csrf")
    public Result<Map<String, String>> csrf(CsrfToken token) {
        return Result.ok(Map.of("headerName", token.getHeaderName(), "token", token.getToken()));
    }
}
