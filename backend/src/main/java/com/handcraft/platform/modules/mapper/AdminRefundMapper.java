package com.handcraft.platform.modules.mapper;
import com.handcraft.platform.modules.dto.AdminRefundQueryDTO;
import com.handcraft.platform.modules.entity.*;
import java.util.List;
import org.apache.ibatis.annotations.*;
/** 管理员上下文查询保持只读，裁定更新不改申请原文或资金快照。 */
@Mapper
public interface AdminRefundMapper {
    String FILTER="""
        <where>o.order_type='CUSTOM'
          <if test='q.status != null and q.status != "ALL"'>AND r.status=#{q.status}</if>
          <if test='q.applicationType != null and q.applicationType != "ALL"'>AND r.application_type=#{q.applicationType}</if>
          <if test='q.orderNo != null and q.orderNo != ""'>AND LOCATE(#{q.orderNo},o.order_no)>0</if>
        </where>
        """;
    @Select("<script>SELECT r.* FROM refund_application r JOIN trade_order o ON o.id=r.order_id "+FILTER+" ORDER BY r.created_at,r.id LIMIT #{q.size} OFFSET #{offset}</script>")
    List<RefundApplication> queue(@Param("q") AdminRefundQueryDTO query,@Param("offset") int offset);
    @Select("<script>SELECT COUNT(*) FROM refund_application r JOIN trade_order o ON o.id=r.order_id "+FILTER+"</script>")
    long count(@Param("q") AdminRefundQueryDTO query);
    @Select("SELECT * FROM operation_log WHERE (target_type='ORDER' AND target_id=#{orderId}) OR (target_type='REFUND_APPLICATION' AND target_id IN (SELECT id FROM refund_application WHERE order_id=#{orderId})) ORDER BY id")
    List<WorkOperation> history(Long orderId);
    @Select("SELECT * FROM operation_log WHERE target_type='REFUND_APPLICATION' AND target_id=#{id} AND action='ADMIN_REFUND_DECISION' AND result='SUCCESS' ORDER BY id DESC LIMIT 1")
    WorkOperation decision(Long id);
    @Update("UPDATE refund_application SET return_required=#{returnRequired},return_tracking_no=#{returnTrackingNo},return_confirmed_at=#{returnConfirmedAt},return_confirmed_by=#{returnConfirmedBy},no_return_basis=#{noReturnBasis} WHERE id=#{id} AND status='WAIT_ADMIN'")
    int returnFacts(RefundApplication refund);
    /** 精确查验实际引用；未提交临时文件及其他订单资料一律不赋权。 */
    @Select("""
        SELECT EXISTS(SELECT 1 FROM trade_order o WHERE o.id=#{orderId} AND (
          JSON_CONTAINS(o.agreement_snapshot,JSON_QUOTE(CAST(#{fileId} AS CHAR)),'$.request.referenceImageIds')
          OR JSON_CONTAINS(o.agreement_snapshot,JSON_QUOTE(CAST(#{fileId} AS CHAR)),'$.imageIds')))
        OR EXISTS(SELECT 1 FROM order_progress_record p JOIN order_progress_node n ON n.id=p.node_id
          WHERE n.order_id=#{orderId} AND JSON_CONTAINS(p.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))
        OR EXISTS(SELECT 1 FROM refund_application r WHERE r.order_id=#{orderId}
          AND JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))
        OR EXISTS(SELECT 1 FROM refund_evidence e JOIN refund_application r ON r.id=e.refund_application_id
          WHERE r.order_id=#{orderId} AND JSON_CONTAINS(e.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))
        OR EXISTS(SELECT 1 FROM chat_message m JOIN conversation c ON c.id=m.conversation_id
          JOIN trade_order o ON o.id=c.order_id WHERE o.id=#{orderId} AND c.buyer_id=o.buyer_id
          AND c.creator_id=o.creator_id AND c.request_id=o.request_id
          AND JSON_CONTAINS(m.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))
        """)
    boolean imageReferenced(@Param("orderId")Long orderId,@Param("fileId")Long fileId);
}
