package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.OrderReview;
import com.handcraft.platform.modules.entity.ReviewReport;
import com.handcraft.platform.modules.entity.ReviewReportEvidence;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 评价及评价举报持久化；治理只追加操作历史，不删除交易证据。 */
@Mapper
public interface OrderReviewMapper {
    @Select("SELECT * FROM order_review WHERE order_id=#{orderId}") OrderReview byOrder(Long orderId);
    @Select("SELECT * FROM order_review WHERE id=#{id}") OrderReview find(Long id);
    @Select("SELECT * FROM order_review WHERE id=#{id} FOR UPDATE") OrderReview lock(Long id);
    @Select("SELECT r.* FROM order_review r JOIN trade_order o ON o.id=r.order_id WHERE r.creator_id=#{creatorId} AND r.moderation_status='VISIBLE' AND o.status<>'REFUNDED' ORDER BY r.created_at DESC,r.id DESC LIMIT #{size} OFFSET #{offset}")
    List<OrderReview> creatorPage(@Param("creatorId")Long creatorId,@Param("offset")int offset,@Param("size")int size);
    @Select("SELECT COUNT(*) FROM order_review r JOIN trade_order o ON o.id=r.order_id WHERE r.creator_id=#{creatorId} AND r.moderation_status='VISIBLE' AND o.status<>'REFUNDED'") long creatorCount(Long creatorId);
    @Insert("INSERT INTO order_review(order_id,buyer_id,creator_id,rating,content,image_ids) VALUES(#{orderId},#{buyerId},#{creatorId},#{rating},#{content},#{imageIds})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(OrderReview review);
    @Update("UPDATE order_review SET moderation_status=#{status} WHERE id=#{id}") int moderate(@Param("id")Long id,@Param("status")String status);
    @Select("SELECT * FROM report WHERE id=#{id}") ReviewReport report(Long id);
    @Select("SELECT * FROM report WHERE id=#{id} FOR UPDATE") ReviewReport lockReport(Long id);
    @Select("SELECT * FROM report WHERE reporter_id=#{userId} AND target_type='REVIEW' AND target_id=#{reviewId} AND status='PENDING'") ReviewReport pending(@Param("userId")Long userId,@Param("reviewId")Long reviewId);
    @Select("SELECT * FROM report WHERE reporter_id=#{userId} AND target_type='REVIEW' ORDER BY created_at DESC,id DESC LIMIT #{size} OFFSET #{offset}") List<ReviewReport> reporterReports(@Param("userId")Long userId,@Param("offset")int offset,@Param("size")int size);
    @Select("SELECT * FROM report WHERE target_type='REVIEW' AND target_id=#{reviewId} ORDER BY created_at DESC,id DESC") List<ReviewReport> reviewReports(Long reviewId);
    @Select("SELECT COUNT(*) FROM report WHERE reporter_id=#{userId} AND target_type='REVIEW'") long reporterReportCount(Long userId);
    @Select("SELECT * FROM report WHERE target_type='REVIEW' AND (#{status}='ALL' OR status=#{status}) ORDER BY created_at,id LIMIT #{size} OFFSET #{offset}") List<ReviewReport> adminReports(@Param("status")String status,@Param("offset")int offset,@Param("size")int size);
    @Select("SELECT COUNT(*) FROM report WHERE target_type='REVIEW' AND (#{status}='ALL' OR status=#{status})") long adminReportCount(String status);
    @Insert("INSERT INTO report(reporter_id,target_type,target_id,reason_code,description,image_ids) VALUES(#{reporterId},'REVIEW',#{targetId},#{reasonCode},#{description},#{imageIds})") @Options(useGeneratedKeys=true,keyProperty="id") int insertReport(ReviewReport report);
    @Update("UPDATE report SET status='PROCESSED',latest_result=#{result},handler_id=#{handlerId},last_processed_at=#{now} WHERE id=#{id} AND status='PENDING'") int decideReport(@Param("id")Long id,@Param("result")String result,@Param("handlerId")Long handlerId,@Param("now")java.time.LocalDateTime now);
    @Update("UPDATE report SET latest_result=#{result},handler_id=#{handlerId},last_processed_at=#{now} WHERE id=#{id} AND status='PROCESSED'") int correctReport(@Param("id")Long id,@Param("result")String result,@Param("handlerId")Long handlerId,@Param("now")java.time.LocalDateTime now);
    @Insert("INSERT INTO report_evidence(report_id,submitter_id,evidence_type,content,image_ids) VALUES(#{reportId},#{submitterId},#{type},#{content},#{imageIds})") int addEvidence(@Param("reportId")Long reportId,@Param("submitterId")Long submitterId,@Param("type")String type,@Param("content")String content,@Param("imageIds")String imageIds);
    @Select("SELECT COUNT(*) FROM report_evidence WHERE report_id=#{reportId}") long evidenceCount(Long reportId);
    @Select("SELECT * FROM report_evidence WHERE report_id=#{reportId} ORDER BY id") List<ReviewReportEvidence> evidence(Long reportId);
    @Select("SELECT reason FROM operation_log WHERE target_type='REVIEW_REPORT' AND target_id=#{id} AND action IN ('DECIDE','CORRECT') ORDER BY id DESC LIMIT 1") String decisionReason(Long id);
    @Select("SELECT id,operator_id,operator_type,action,before_status,after_status,reason,detail,created_at FROM operation_log WHERE target_type='REVIEW_REPORT' AND target_id=#{id} AND action IN ('DECIDE','CORRECT') ORDER BY id") List<com.handcraft.platform.modules.entity.WorkOperation> reportHistory(Long id);
    /** 从同一评价的实际治理记录识别当前生效的举报及其恢复范围。 */
    @Select("""
        SELECT l.target_id AS reportId,
               JSON_UNQUOTE(JSON_EXTRACT(l.detail,'$.decision')) AS decision,
               JSON_UNQUOTE(JSON_EXTRACT(l.detail,'$.beforeModerationStatus')) AS beforeStatus,
               JSON_UNQUOTE(JSON_EXTRACT(l.detail,'$.moderationStatus')) AS afterStatus
        FROM report r JOIN operation_log l ON l.target_id=r.id AND l.target_type='REVIEW_REPORT'
        WHERE r.target_type='REVIEW' AND r.target_id=#{reviewId} AND l.action IN ('DECIDE','CORRECT')
          AND JSON_UNQUOTE(JSON_EXTRACT(l.detail,'$.decision')) IN ('HIDE','DELETE','RESTORE')
        ORDER BY l.id
        """)
    List<ModerationChange> moderationChanges(Long reviewId);

    record ModerationChange(
            /** 处置所属举报。 */ Long reportId,
            /** 隐藏、删除或恢复。 */ String decision,
            /** 操作前的评价状态。 */ String beforeStatus,
            /** 操作后的评价状态。 */ String afterStatus) {}
    @Select("SELECT id FROM operation_log WHERE target_type='REVIEW_REPORT' AND target_id=#{id} AND action IN ('DECIDE','CORRECT') ORDER BY id DESC LIMIT 1") Long decisionEventId(Long id);
    @Select("SELECT COUNT(*) FROM report r JOIN order_review rv ON rv.id=r.target_id WHERE r.target_type='REVIEW' AND (JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))) OR EXISTS(SELECT 1 FROM report_evidence e WHERE e.report_id=r.id AND JSON_CONTAINS(e.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))) AND (#{admin}=1 OR r.reporter_id=#{userId} OR rv.buyer_id=#{userId} OR rv.creator_id=#{userId})") int canReadReportImage(@Param("userId")Long userId,@Param("fileId")Long fileId,@Param("admin")boolean admin);
    @Select("SELECT COUNT(*) FROM order_review WHERE JSON_CONTAINS(image_ids,JSON_QUOTE(CAST(#{id} AS CHAR)))") int imageReferences(Long id);
    @Select("SELECT COUNT(*) FROM order_review r JOIN trade_order o ON o.id=r.order_id WHERE r.moderation_status='VISIBLE' AND o.status<>'REFUNDED' AND JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(#{id} AS CHAR)))") int publicImageReferences(Long id);
    @Select("SELECT COUNT(*) FROM order_review r JOIN trade_order o ON o.id=r.order_id WHERE JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))) AND ((r.moderation_status='VISIBLE' AND o.status<>'REFUNDED') OR #{admin}=1 OR r.buyer_id=#{userId} OR r.creator_id=#{userId})") int canReadReviewImage(@Param("userId")Long userId,@Param("fileId")Long fileId,@Param("admin")boolean admin);
    @Select("SELECT o.* FROM order_review r JOIN trade_order o ON o.id=r.order_id WHERE r.id=#{reviewId}") com.handcraft.platform.modules.entity.TradeOrder reviewOrder(Long reviewId);
    @Select("SELECT COUNT(*) FROM report WHERE target_type='REVIEW' AND target_id=#{reviewId} AND reporter_id=#{userId}") long hasReported(@Param("userId")Long userId,@Param("reviewId")Long reviewId);
}
