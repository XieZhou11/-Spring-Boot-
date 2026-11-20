package com.handcraft.platform.modules.mapper;
import com.handcraft.platform.modules.entity.*;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;
/** 调用方持用户、需求及订单锁后，按退款、结算、节点、会话、文件顺序访问下游。 */
@Mapper
public interface OrderFulfillmentMapper {
    @Select("SELECT EXISTS(SELECT 1 FROM refund_application WHERE order_id=#{id} AND status='WAIT_ADMIN')") boolean hasPending(Long id);
    @Select("SELECT * FROM order_progress_node WHERE order_id=#{id} ORDER BY sort_order FOR UPDATE")
    @Options(flushCache=Options.FlushCachePolicy.TRUE) List<OrderProgressNode> lockNodes(Long id);
    @Select("SELECT * FROM order_progress_record WHERE node_id=#{id} ORDER BY id") List<OrderProgressRecord> records(Long id);
    @Select("SELECT * FROM order_progress_record WHERE creator_id=#{creatorId} AND request_key=#{key}")
    OrderProgressRecord recordByKey(@Param("creatorId")Long creatorId,@Param("key")String key);
    @Insert("INSERT INTO order_progress_record(node_id,creator_id,request_key,record_type,content,image_ids,skip_reason,created_at) VALUES(#{nodeId},#{creatorId},#{requestKey},#{recordType},#{content},#{imageIds},#{skipReason},#{createdAt})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insertRecord(OrderProgressRecord record);
    @Update("UPDATE order_progress_node SET status=#{status},handled_at=#{handledAt},updated_at=#{now} WHERE id=#{id}")
    int nodeState(@Param("id")Long id,@Param("status")String status,@Param("handledAt")LocalDateTime handledAt,@Param("now")LocalDateTime now);
    @Update("UPDATE trade_order SET status=#{status},started_at=#{startedAt},tracking_no=#{trackingNo},shipped_at=#{shippedAt},auto_confirm_at=#{autoConfirmAt},original_completed_at=#{originalCompletedAt},updated_at=#{updatedAt} WHERE id=#{id}")
    int updateOrder(TradeOrder order);
    @Select("SELECT * FROM refund_application WHERE order_id=#{id} AND status='WAIT_ADMIN' FOR UPDATE")
    @Options(flushCache=Options.FlushCachePolicy.TRUE) RefundApplication pending(Long id);
    @Select("SELECT * FROM refund_application WHERE order_id=#{id} AND application_type='NO_START_TIMEOUT' AND status='REFUNDED' ORDER BY id LIMIT 1")
    RefundApplication refunded(Long id);
    @Select("SELECT * FROM order_settlement WHERE order_id=#{id} FOR UPDATE")
    @Options(flushCache=Options.FlushCachePolicy.TRUE) OrderSettlement lockSettlement(Long id);
    @Insert("INSERT INTO refund_application(order_id,buyer_id,application_type,original_order_status,reason_code,description,image_ids,status,return_required,no_return_basis,decision_reason,finished_at,created_at,updated_at) VALUES(#{orderId},#{buyerId},'NO_START_TIMEOUT','PAID','NO_START_TIMEOUT',#{description},#{imageIds},'REFUNDED',0,'订单尚未开工且未发货，无需退回成品',#{decisionReason},#{finishedAt},#{createdAt},#{createdAt})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insertRefund(RefundApplication refund);
    @Insert("INSERT INTO fund_flow(flow_no,order_id,refund_application_id,flow_type,amount,result,idempotency_key,occurred_at) VALUES(#{flow.flowNo},#{flow.orderId},#{refundId},'REFUND',#{flow.amount},'SUCCESS',#{flow.idempotencyKey},#{flow.occurredAt})")
    int refundFlow(@Param("flow")FundFlow flow,@Param("refundId")Long refundId);
    @Select("SELECT * FROM fund_flow WHERE order_id=#{id} AND flow_type='REFUND' AND result='SUCCESS'") FundFlow refundFlowForOrder(Long id);
    @Update("UPDATE order_settlement SET status='CANCELLED',cancelled_at=#{now},updated_at=#{now} WHERE order_id=#{id} AND status='PENDING'")
    int cancelSettlement(@Param("id")Long id,@Param("now")LocalDateTime now);
    @Insert("INSERT INTO fund_flow(flow_no,order_id,refund_application_id,flow_type,amount,result,idempotency_key,occurred_at) VALUES(#{flow.flowNo},#{flow.orderId},NULL,'SETTLEMENT',#{flow.amount},'SUCCESS',#{flow.idempotencyKey},#{flow.occurredAt})")
    @Options(useGeneratedKeys=true,keyProperty="flow.id") int settlementFlow(@Param("flow")FundFlow flow);
    @Select("SELECT * FROM fund_flow WHERE order_id=#{id} AND flow_type='SETTLEMENT' AND result='SUCCESS'") FundFlow settlementFlowForOrder(Long id);
    @Update("UPDATE order_settlement SET status='SETTLED',settlement_flow_id=#{flowId},settled_at=#{now},updated_at=#{now} WHERE order_id=#{id} AND status='PENDING'")
    int markSettled(@Param("id")Long id,@Param("flowId")Long flowId,@Param("now")LocalDateTime now);
    /** 仅扫描已过七天完成窗口且无处理中售后的待结算订单；键集遍历保证单笔失败不饿死更高编号订单。 */
    @Select("""
        SELECT s.order_id FROM order_settlement s JOIN trade_order o ON o.id=s.order_id
        WHERE s.status='PENDING' AND s.order_id>#{after}
        AND o.status='COMPLETED' AND o.original_completed_at IS NOT NULL
        AND DATE_ADD(o.original_completed_at,INTERVAL 7 DAY)<=#{now}
        AND NOT EXISTS(SELECT 1 FROM refund_application a WHERE a.order_id=o.id AND a.status='WAIT_ADMIN')
        ORDER BY s.order_id LIMIT 100
        """)
    List<Long> dueSettlements(@Param("after")Long after,@Param("now")LocalDateTime now);
    @Select("SELECT * FROM operation_log WHERE operator_id=#{creatorId} AND target_type='ORDER' AND action='TRACKING_CORRECT' AND JSON_UNQUOTE(JSON_EXTRACT(detail,'$.requestKey'))=#{key} ORDER BY id LIMIT 1")
    WorkOperation correctionByKey(@Param("creatorId")Long creatorId,@Param("key")String key);
    @Select("SELECT * FROM operation_log WHERE target_type='ORDER' AND target_id=#{orderId} AND action=#{action} ORDER BY id DESC LIMIT 1")
    WorkOperation operation(@Param("orderId")Long orderId,@Param("action")String action);
    @Select("SELECT * FROM operation_log WHERE target_type='ORDER' AND target_id=#{orderId} AND action='TRACKING_CORRECT' ORDER BY id")
    List<WorkOperation> corrections(Long orderId);
    /** 仅扫描到期且仍需处理的订单；键集遍历使单笔失败不会饿死更高编号订单。 */
    @Select("""
        SELECT o.id FROM trade_order o LEFT JOIN custom_request r ON r.id=o.request_id
        WHERE o.order_type IN ('CUSTOM','STOCK') AND o.id>#{after}
        AND NOT EXISTS(SELECT 1 FROM refund_application a WHERE a.order_id=o.id AND a.status='WAIT_ADMIN')
        AND (
          (o.status IN ('PAID','IN_PRODUCTION','PENDING_SHIP') AND o.shipped_at IS NULL AND o.ship_deadline_at<=#{now}
            AND (NOT EXISTS(SELECT 1 FROM system_notification n WHERE n.recipient_id=o.buyer_id AND n.event_key=CONCAT('ORDER_SHIPPING_OVERDUE:',o.id))
              OR NOT EXISTS(SELECT 1 FROM system_notification n WHERE n.recipient_id=o.creator_id AND n.event_key=CONCAT('ORDER_SHIPPING_OVERDUE:',o.id))))
          OR (o.status='SHIPPED' AND o.auto_confirm_at<=#{now})
          OR (o.order_type='CUSTOM' AND o.status='COMPLETED' AND r.status='IN_TRADE' AND DATE_ADD(o.original_completed_at,INTERVAL 7 DAY)<=#{now})
        ) ORDER BY o.id LIMIT 100
        """)
    List<Long> scanAfter(@Param("after")Long after,@Param("now")LocalDateTime now);
}
