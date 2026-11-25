package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.InteractionComment;
import com.handcraft.platform.modules.entity.ReviewReport;
import com.handcraft.platform.modules.entity.ReviewReportEvidence;
import com.handcraft.platform.modules.entity.Work;
import com.handcraft.platform.modules.entity.WorkOperation;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 内容举报持久化：作品、评论与创作者主页共用 report 表，处置留痕走 CONTENT_REPORT 操作日志。 */
@Mapper
public interface ContentReportMapper {
    @Select("SELECT * FROM report WHERE id=#{id}") ReviewReport report(Long id);
    @Select("SELECT * FROM report WHERE id=#{id} FOR UPDATE") ReviewReport lockReport(Long id);
    @Select("SELECT * FROM report WHERE reporter_id=#{userId} AND target_type=#{targetType} AND target_id=#{targetId} AND status='PENDING'")
    ReviewReport pending(@Param("userId")Long userId,@Param("targetType")String targetType,@Param("targetId")Long targetId);
    @Insert("INSERT INTO report(reporter_id,target_type,target_id,reason_code,description,image_ids) VALUES(#{reporterId},#{targetType},#{targetId},#{reasonCode},#{description},#{imageIds})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insertReport(ReviewReport report);
    @Insert("INSERT INTO report_evidence(report_id,submitter_id,evidence_type,content,image_ids) VALUES(#{reportId},#{submitterId},#{type},#{content},#{imageIds})")
    int addEvidence(@Param("reportId")Long reportId,@Param("submitterId")Long submitterId,@Param("type")String type,@Param("content")String content,@Param("imageIds")String imageIds);
    @Select("SELECT * FROM report_evidence WHERE report_id=#{reportId} ORDER BY id") List<ReviewReportEvidence> evidence(Long reportId);
    @Select("SELECT * FROM report WHERE reporter_id=#{userId} ORDER BY created_at DESC,id DESC LIMIT #{size} OFFSET #{offset}")
    List<ReviewReport> reporterReports(@Param("userId")Long userId,@Param("offset")int offset,@Param("size")int size);
    @Select("SELECT COUNT(*) FROM report WHERE reporter_id=#{userId}") long reporterReportCount(Long userId);
    @Select("SELECT * FROM report WHERE (#{type}='ALL' OR target_type=#{type}) AND (#{status}='ALL' OR status=#{status}) ORDER BY created_at,id LIMIT #{size} OFFSET #{offset}")
    List<ReviewReport> adminReports(@Param("status")String status,@Param("type")String type,@Param("offset")int offset,@Param("size")int size);
    @Select("SELECT COUNT(*) FROM report WHERE (#{type}='ALL' OR target_type=#{type}) AND (#{status}='ALL' OR status=#{status})")
    long adminReportCount(@Param("status")String status,@Param("type")String type);
    @Update("UPDATE report SET status='PROCESSED',latest_result=#{result},handler_id=#{handlerId},last_processed_at=#{now} WHERE id=#{id} AND status='PENDING'")
    int decideReport(@Param("id")Long id,@Param("result")String result,@Param("handlerId")Long handlerId,@Param("now")java.time.LocalDateTime now);
    @Update("UPDATE report SET latest_result=#{result},handler_id=#{handlerId},last_processed_at=#{now} WHERE id=#{id} AND status='PROCESSED'")
    int correctReport(@Param("id")Long id,@Param("result")String result,@Param("handlerId")Long handlerId,@Param("now")java.time.LocalDateTime now);
    @Select("SELECT reason FROM operation_log WHERE target_type=#{type} AND target_id=#{id} AND action IN ('DECIDE','CORRECT') ORDER BY id DESC LIMIT 1")
    String decisionReason(@Param("id") Long id,@Param("type") String type);
    @Select("SELECT id,operator_id,operator_type,action,before_status,after_status,reason,detail,created_at FROM operation_log WHERE target_type='CONTENT_REPORT' AND target_id=#{id} AND action IN ('DECIDE','CORRECT') ORDER BY id")
    List<WorkOperation> reportHistory(Long id);
    /** 最近一次有效的目标状态变更。详情保留对应举报编号和作品版本供恢复校验。 */
    @Select("SELECT JSON_SET(l.detail,'$.reportId',CAST(r.id AS CHAR),'$.operationId',CAST(l.id AS CHAR)) FROM operation_log l JOIN report r ON r.id=l.target_id WHERE l.target_type='CONTENT_REPORT' AND r.target_type=#{type} AND r.target_id=#{targetId} AND l.action IN ('DECIDE','CORRECT') AND JSON_UNQUOTE(JSON_EXTRACT(l.detail,'$.decision')) IN ('HIDE','OFFLINE','PAUSE','RESTORE','RESUME') ORDER BY l.id DESC LIMIT 1")
    String lastModeration(@Param("type") String type,@Param("targetId") Long targetId);
    /** 最近一次账号处置的来源。旧记录用操作顺序确认其后没有新的账号暂停。 */
    @Select("SELECT id FROM operation_log WHERE target_type='USER' AND target_id=#{id} AND action IN ('ADMIN_BUSINESS_PAUSE','ADMIN_BUSINESS_RESUME') ORDER BY id DESC LIMIT 1")
    Long latestAccountDecision(Long id);

    /** 处置日志已在同一事务中追加，行锁确保读取的是本次事件。 */
    @Select("SELECT id FROM operation_log WHERE target_type=#{type} AND target_id=#{id} AND action IN ('DECIDE','CORRECT') ORDER BY id DESC LIMIT 1")
    Long decisionEventId(@Param("id") Long id,@Param("type") String type);

    // 目标行读取与锁定：详情走普通读，处置前先锁定，行级守卫防止状态覆盖。
    @Select("SELECT * FROM work WHERE id=#{id}") Work work(Long id);
    @Select("SELECT * FROM work WHERE id=#{id} FOR UPDATE") Work lockWork(Long id);
    @Select("SELECT * FROM work_comment WHERE id=#{id}") InteractionComment comment(Long id);
    @Select("SELECT * FROM work_comment WHERE id=#{id} FOR UPDATE") InteractionComment lockComment(Long id);
    @Update("UPDATE work_comment SET moderation_status='HIDDEN' WHERE id=#{id} AND moderation_status='VISIBLE' AND user_deleted_at IS NULL") int hideComment(Long id);
    @Update("UPDATE work_comment SET moderation_status='VISIBLE' WHERE id=#{id} AND moderation_status='HIDDEN' AND user_deleted_at IS NULL") int restoreComment(Long id);

    // 摘要与鉴权查询：列表和详情按目标类型取标题、节选或昵称。
    @Select("SELECT content FROM work_comment WHERE id=#{id}") String commentContent(Long id);
    @Select("SELECT content FROM order_review WHERE id=#{id}") String reviewContent(Long id);
    /** 核对文件确实来自该举报指向的原评论。 */
    @Select("SELECT COUNT(*) FROM report r JOIN work_comment c ON c.id=r.target_id WHERE r.id=#{reportId} AND r.target_type='COMMENT' AND JSON_CONTAINS(c.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR)))")
    int originalCommentImage(@Param("reportId")Long reportId,@Param("fileId")Long fileId);
    @Select("SELECT COUNT(*) FROM report r LEFT JOIN work_comment c ON r.target_type='COMMENT' AND c.id=r.target_id LEFT JOIN work w ON (r.target_type='WORK' AND w.id=r.target_id) OR (r.target_type='COMMENT' AND w.id=c.work_id) WHERE r.target_type IN ('WORK','COMMENT','CREATOR_PROFILE') AND (JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))) OR EXISTS(SELECT 1 FROM report_evidence e WHERE e.report_id=r.id AND JSON_CONTAINS(e.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))) AND (#{admin}=1 OR r.reporter_id=#{userId} OR w.creator_id=#{userId} OR c.author_id=#{userId} OR (r.target_type='CREATOR_PROFILE' AND r.target_id=#{userId}))")
    int canReadReportImage(@Param("userId")Long userId,@Param("fileId")Long fileId,@Param("admin")boolean admin);
}
