package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.vo.*;
import com.handcraft.platform.modules.dto.WorkCommentDTO;
/** 作品互动与个人关系查询；用户编号必须来自会话。 */
public interface WorkInteractionService {
 /** 查询公开作品统计及本人关系。 */ WorkInteractionStatsVO stats(Long userId,Long workId);
 /** 幂等添加或取消点赞、收藏。 */ WorkReactionStateVO reaction(Long userId,Long workId,String type,boolean add);
 /** 分页查询本人收藏，失效作品隐藏内容。 */ PageVO<FavoriteWorkVO> favorites(Long userId,int page,int size);
 /** 分页查询公开评论。 */ PageVO<WorkCommentVO> comments(Long userId,Long workId,int page,int size);
 /** 校验文字和图片后提交评论。 */ WorkCommentVO comment(Long userId,Long workId,WorkCommentDTO input);
 /** 仅本人软删除评论，保留历史证据。 */ void deleteComment(Long userId,Long commentId);
 /** 查询本人关注状态。 */ CreatorFollowStateVO followState(Long userId,Long creatorId);
 /** 幂等添加或取消关注。 */ CreatorFollowStateVO follow(Long userId,Long creatorId,boolean add);
 /** 分页查询本人关注列表。 */ PageVO<FollowedCreatorVO> follows(Long userId,int page,int size);
}
