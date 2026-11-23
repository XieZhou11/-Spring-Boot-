package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.dto.AdminOrderQueryDTO;
import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;
import org.apache.ibatis.annotations.*;

/** 管理员跨类型只读订单检索。 */
@Mapper
public interface AdminOrderMapper {
    String FILTER="<where><if test='q.orderNo != null and q.orderNo != &quot;&quot;'>AND LOCATE(#{q.orderNo},o.order_no)&gt;0</if><if test='q.status != null and q.status != &quot;ALL&quot;'>AND (CASE WHEN o.status='PENDING_PAY' AND o.pay_deadline_at&lt;=#{now} THEN 'CANCELLED' ELSE o.status END)=#{q.status}</if><if test='q.orderType != null and q.orderType != &quot;ALL&quot;'>AND o.order_type=#{q.orderType}</if><if test='q.createdFrom != null'>AND o.created_at&gt;=#{q.createdFrom}</if><if test='q.createdTo != null'>AND o.created_at&lt;=#{q.createdTo}</if><if test='q.minAmount != null'>AND o.total_amount&gt;=#{q.minAmount}</if><if test='q.maxAmount != null'>AND o.total_amount&lt;=#{q.maxAmount}</if></where>";
    String COLS="o.id AS orderId,o.order_no AS orderNo,o.order_type AS orderType,CASE WHEN o.status='PENDING_PAY' AND o.pay_deadline_at&lt;=#{now} THEN 'CANCELLED' ELSE o.status END AS status,o.title_snapshot AS title,o.total_amount AS amount,o.buyer_id AS buyerId,b.nickname AS buyerNickname,o.creator_id AS creatorId,c.nickname AS creatorNickname,o.created_at AS createdAt";
    @Select("<script>SELECT "+COLS+" FROM trade_order o JOIN user_account b ON b.id=o.buyer_id JOIN user_account c ON c.id=o.creator_id "+FILTER+" ORDER BY CASE WHEN o.status='AFTER_SALE' THEN 0 ELSE 1 END,o.created_at DESC,o.id DESC LIMIT #{q.size} OFFSET #{offset}</script>")
    List<Map<String,Object>> list(@Param("q")AdminOrderQueryDTO q,@Param("offset")int offset,@Param("now")LocalDateTime now);
    @Select("<script>SELECT COUNT(*) FROM trade_order o "+FILTER+"</script>") long count(@Param("q")AdminOrderQueryDTO q,@Param("now")LocalDateTime now);
}
