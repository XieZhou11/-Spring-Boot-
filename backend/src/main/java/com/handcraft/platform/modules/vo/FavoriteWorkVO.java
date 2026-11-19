package com.handcraft.platform.modules.vo;
/**
 * @param workId 收藏作品编号
 * @param available 作品当前公开可见
 * @param title 公开标题，失效为空
 * @param creatorId 创作者编号，失效为空
 * @param creatorNickname 创作者昵称，失效为空
 * @param coverImage 公开封面短时地址，失效为空
 * @param favoritedAt 收藏时间
 */
public record FavoriteWorkVO(String workId,boolean available,String title,String creatorId,String creatorNickname,ImageVO coverImage,java.time.OffsetDateTime favoritedAt) {}
