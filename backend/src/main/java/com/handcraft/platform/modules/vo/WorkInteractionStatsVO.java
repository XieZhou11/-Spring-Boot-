package com.handcraft.platform.modules.vo;
/**
 * @param likeCount 点赞总数
 * @param favoriteCount 收藏总数
 * @param commentCount 公开评论总数
 * @param liked 本人已点赞
 * @param favorited 本人已收藏
 */
public record WorkInteractionStatsVO(long likeCount,long favoriteCount,long commentCount,boolean liked,boolean favorited) {}
