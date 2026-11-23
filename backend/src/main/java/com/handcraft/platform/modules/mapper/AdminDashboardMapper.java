package com.handcraft.platform.modules.mapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** 只读聚合后台所需账号、内容、订单和资金指标。 */
@Mapper
public interface AdminDashboardMapper {
    @Select("SELECT COUNT(*) FROM user_account") long users();
    @Select("SELECT COUNT(*) FROM user_account WHERE created_at>=#{from} AND created_at<#{to}") long newUsers(@Param("from")LocalDateTime from,@Param("to")LocalDateTime to);
    @Select("SELECT COUNT(*) FROM user_account WHERE is_admin=0 AND certification_status='APPROVED'") long creators();
    @Select("SELECT COUNT(*) FROM user_account u JOIN creator_application a ON a.id=u.approved_application_id WHERE u.is_admin=0 AND u.certification_status='APPROVED' AND a.reviewed_at>=#{from} AND a.reviewed_at<#{to}") long newCreators(@Param("from")LocalDateTime from,@Param("to")LocalDateTime to);
    @Select("SELECT review_status AS status,COUNT(*) AS total FROM work WHERE deleted_at IS NULL GROUP BY review_status") List<Map<String,Object>> works();
    @Select("SELECT status,COUNT(*) AS total FROM custom_request WHERE deleted_at IS NULL GROUP BY status") List<Map<String,Object>> requests();
    @Select("<script>SELECT CONCAT(order_type,':',CASE WHEN status='PENDING_PAY' AND pay_deadline_at &lt;= #{now} THEN 'CANCELLED' ELSE status END) AS status,COUNT(*) AS total FROM (SELECT order_type,status,pay_deadline_at FROM trade_order) t GROUP BY CONCAT(order_type,':',CASE WHEN status='PENDING_PAY' AND pay_deadline_at &lt;= #{now} THEN 'CANCELLED' ELSE status END)</script>") List<Map<String,Object>> orders(@Param("now")LocalDateTime now);
    @Select("SELECT COALESCE(SUM(amount),0) FROM fund_flow WHERE flow_type='PAYMENT' AND result='SUCCESS'") BigDecimal payments();
    @Select("SELECT COALESCE(SUM(amount),0) FROM fund_flow WHERE flow_type='REFUND' AND result='SUCCESS'") BigDecimal refunds();
    @Select("SELECT COALESCE(SUM(paid_amount),0) FROM order_settlement WHERE status='PENDING'") BigDecimal pending();
    @Select("SELECT COALESCE(SUM(amount),0) FROM fund_flow WHERE flow_type='SETTLEMENT' AND result='SUCCESS'") BigDecimal settled();
    @Select("SELECT COUNT(*) FROM creator_application WHERE status='PENDING'") long pendingApplications();
    @Select("SELECT COUNT(*) FROM work WHERE review_status='PENDING' AND deleted_at IS NULL") long pendingWorks();
    @Select("SELECT COUNT(*) FROM report WHERE status='PENDING'") long pendingReports();
    @Select("SELECT COUNT(*) FROM refund_application WHERE status='WAIT_ADMIN'") long pendingRefunds();
}
