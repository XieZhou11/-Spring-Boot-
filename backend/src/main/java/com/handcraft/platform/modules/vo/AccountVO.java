package com.handcraft.platform.modules.vo;

/**
 * 账号创建结果，不包含密码摘要或认证内部信息。
 *
 * @param userId 账号编号，以字符串表示，避免浏览器整数精度损失
 * @param email 规范化后的登录邮箱
 * @param nickname 用户昵称
 */
public record AccountVO(String userId, String email, String nickname) {}
