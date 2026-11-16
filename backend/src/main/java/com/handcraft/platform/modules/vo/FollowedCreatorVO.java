package com.handcraft.platform.modules.vo;
/**
 * @param creatorId 关注创作者编号
 * @param nickname 公开昵称
 * @param bio 公开简介
 * @param avatarUrl 头像短时地址
 * @param avatarExpiresAt 头像地址失效时间
 * @param paused 创作者已暂停新业务
 * @param available 创作者当前认证有效
 * @param followedAt 关注时间
 */
public record FollowedCreatorVO(String creatorId,String nickname,String bio,String avatarUrl,java.time.OffsetDateTime avatarExpiresAt,boolean paused,boolean available,java.time.OffsetDateTime followedAt) {}
