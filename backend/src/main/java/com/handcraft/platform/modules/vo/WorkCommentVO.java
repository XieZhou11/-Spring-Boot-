package com.handcraft.platform.modules.vo;
/**
 * @param id 评论编号
 * @param workId 作品编号
 * @param authorId 作者编号
 * @param authorNickname 作者昵称
 * @param avatarUrl 作者头像短时地址
 * @param avatarExpiresAt 头像地址失效时间
 * @param content 评论正文
 * @param imageIds 评论图片编号
 * @param images 私有图片短时地址
 * @param createdAt 发表时间
 * @param canDelete 本人可删除
 */
public record WorkCommentVO(String id,String workId,String authorId,String authorNickname,String avatarUrl,java.time.OffsetDateTime avatarExpiresAt,String content,java.util.List<String> imageIds,java.util.List<ImageVO> images,java.time.OffsetDateTime createdAt,boolean canDelete) {}
