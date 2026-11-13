package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.LoginDTO;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.SessionService;
import com.handcraft.platform.modules.vo.SessionVO;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 会话资源接口；查询和退出仅作用于当前 Cookie 对应会话。 */
@RestController
@RequestMapping("/api/sessions")
public class SessionController {
    private final SessionService sessions;

    public SessionController(SessionService sessions) {
        this.sessions = sessions;
    }

    /** 校验邮箱密码并建立新的七天会话，不接收客户端自报身份。 */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Result<SessionVO> login(
            @Valid @RequestBody LoginDTO input,
            HttpServletRequest request,
            HttpServletResponse response) {
        return Result.ok(sessions.login(input, request, response));
    }

    /** 查询当前 Cookie 对应的本人会话。 */
    @GetMapping("/current")
    public Result<SessionVO> current(@AuthenticationPrincipal AccountPrincipal principal) {
        return Result.ok(sessions.current(principal));
    }

    /** 退出当前设备，其他设备会话继续有效。 */
    @DeleteMapping("/current")
    public Result<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        sessions.logout(request, response);
        return Result.ok();
    }
}
