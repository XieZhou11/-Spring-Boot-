package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 仅供本人读取的会话视图，不序列化安全主体或数据库实体。
 *
 * @param userId 账号编号，以字符串返回
 * @param email 规范化后的登录邮箱
 * @param nickname 用户昵称
 * @param roles 服务端判定的账号可用身份
 * @param activeRole 当前会话默认身份
 * @param expiresAt 本次登录的绝对失效时刻，包含北京时间偏移
 */
public record SessionVO(
        String userId,
        String email,
        String nickname,
        List<String> roles,
        String activeRole,
        OffsetDateTime expiresAt) {}
