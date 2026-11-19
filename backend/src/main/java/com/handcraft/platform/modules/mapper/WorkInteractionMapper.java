package com.handcraft.platform.modules.mapper;
import com.handcraft.platform.modules.entity.*;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.*;
/** 互动SQL：写操作由用户→作品→文件行锁保护，唯一键保证幂等。 */
@Mapper
public interface WorkInteractionMapper {
 String WORK="id,creator_id,title,main_image_ids,review_status,deleted_at";
 @Select("SELECT "+WORK+" FROM work WHERE id=#{id}") InteractionWork work(Long id);
 @Select("SELECT "+WORK+" FROM work WHERE id=#{id} FOR UPDATE") InteractionWork lockWork(Long id);
 @Select("SELECT COUNT(*) FROM work_reaction WHERE work_id=#{workId} AND reaction_type=#{type}") long reactionCount(@Param("workId")Long workId,@Param("type")String type);
 @Select("SELECT COUNT(*) FROM work_reaction WHERE work_id=#{workId} AND user_id=#{userId} AND reaction_type=#{type}") long reaction(@Param("userId")Long userId,@Param("workId")Long workId,@Param("type")String type);
 @Insert("INSERT INTO work_reaction(user_id,work_id,reaction_type) VALUES(#{userId},#{workId},#{type}) ON DUPLICATE KEY UPDATE id=id") int addReaction(@Param("userId")Long userId,@Param("workId")Long workId,@Param("type")String type);
 @Delete("DELETE FROM work_reaction WHERE user_id=#{userId} AND work_id=#{workId} AND reaction_type=#{type}") int deleteReaction(@Param("userId")Long userId,@Param("workId")Long workId,@Param("type")String type);
 @Select("SELECT work_id,created_at FROM work_reaction WHERE user_id=#{userId} AND reaction_type='FAVORITE' ORDER BY created_at DESC,id DESC LIMIT #{size} OFFSET #{offset}") List<Map<String,Object>> favorites(@Param("userId")Long userId,@Param("offset")int offset,@Param("size")int size);
 @Select("SELECT COUNT(*) FROM work_reaction WHERE user_id=#{userId} AND reaction_type='FAVORITE'") long favoritesCount(Long userId);
 @Select("SELECT COUNT(*) FROM work_comment WHERE work_id=#{workId} AND user_deleted_at IS NULL AND moderation_status='VISIBLE'") long commentCount(Long workId);
 @Select("SELECT * FROM work_comment WHERE work_id=#{workId} AND user_deleted_at IS NULL AND moderation_status='VISIBLE' ORDER BY created_at DESC,id DESC LIMIT #{size} OFFSET #{offset}") List<InteractionComment> comments(@Param("workId")Long workId,@Param("offset")int offset,@Param("size")int size);
 @Select("SELECT * FROM work_comment WHERE id=#{id}") InteractionComment comment(Long id);
 @Insert("INSERT INTO work_comment(work_id,author_id,content,image_ids) VALUES(#{workId},#{authorId},#{content},#{imageIds})") @Options(useGeneratedKeys=true,keyProperty="id") int addComment(InteractionComment c);
 @Update("UPDATE work_comment SET user_deleted_at=COALESCE(user_deleted_at,CURRENT_TIMESTAMP(3)) WHERE id=#{id} AND author_id=#{userId}") int deleteComment(@Param("userId")Long userId,@Param("id")Long id);
 @Select("SELECT COUNT(*) FROM creator_follow WHERE follower_id=#{userId} AND creator_id=#{creatorId}") long following(@Param("userId")Long userId,@Param("creatorId")Long creatorId);
 @Insert("INSERT INTO creator_follow(follower_id,creator_id) VALUES(#{userId},#{creatorId}) ON DUPLICATE KEY UPDATE id=id") int addFollow(@Param("userId")Long userId,@Param("creatorId")Long creatorId);
 @Delete("DELETE FROM creator_follow WHERE follower_id=#{userId} AND creator_id=#{creatorId}") int deleteFollow(@Param("userId")Long userId,@Param("creatorId")Long creatorId);
 @Select("SELECT creator_id,created_at FROM creator_follow WHERE follower_id=#{userId} ORDER BY created_at DESC,id DESC LIMIT #{size} OFFSET #{offset}") List<Map<String,Object>> follows(@Param("userId")Long userId,@Param("offset")int offset,@Param("size")int size);
 @Select("SELECT COUNT(*) FROM creator_follow WHERE follower_id=#{userId}") long followsCount(Long userId);
 /** 历史引用包含隐藏与自删评论，禁止据公开状态删除证据。 */
 @Select("SELECT COUNT(*) FROM work_comment WHERE JSON_CONTAINS(image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR)))") long countCommentImageReferences(Long fileId);
 /** 仅上架作品中的公开评论可对外签发图片地址。 */
 @Select("SELECT COUNT(*) FROM work_comment c JOIN work w ON w.id=c.work_id WHERE c.user_deleted_at IS NULL AND c.moderation_status='VISIBLE' AND w.review_status='ONLINE' AND w.deleted_at IS NULL AND JSON_CONTAINS(c.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR)))") long countPublicCommentImageReferences(Long fileId);
}
