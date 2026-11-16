package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.LoginDTO;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.vo.SessionVO;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** 登录会话业务接口，负责当前设备的登录、查询及退出。 */
public interface SessionService {

    /** 校验账号密码并创建新的会话，轮换登录凭证及 CSRF 令牌。 */
    SessionVO login(LoginDTO loginDTO, HttpServletRequest request, HttpServletResponse response);

    /** 根据服务端认证主体读取本人会话视图，不接受客户端自报身份。 */
    SessionVO current(AccountPrincipal principal);

    /** 校验现有资格后切换当前会话默认入口，保留原登录截止时间。 */
    SessionVO switchRole(AccountPrincipal principal, com.handcraft.platform.modules.dto.ActiveRoleDTO input);

    /** 退出当前会话并清除浏览器会话 Cookie，其他设备不受影响。 */
    void logout(HttpServletRequest request, HttpServletResponse response);
}
