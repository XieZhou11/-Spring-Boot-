package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;

/**
 * 本人资料视图，邮箱仅返回给本人，不包含权限或密码摘要。
 * @param userId 字符串用户编号
 * @param email 本人登录邮箱
 * @param nickname 昵称
 * @param bio 个人简介，未填写时为空字符串
 * @param avatarUrl 短时头像访问地址，无头像或存储不可用时为 null
 * @param avatarExpiresAt 头像地址失效时间，与地址一起刷新
 */
public record ProfileVO(String userId, String email, String nickname, String bio,
                        String avatarUrl, OffsetDateTime avatarExpiresAt) {}
