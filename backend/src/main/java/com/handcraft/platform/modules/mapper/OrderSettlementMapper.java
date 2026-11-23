package com.handcraft.platform.modules.mapper;
import com.handcraft.platform.modules.dto.AdminSettlementQueryDTO;
import com.handcraft.platform.modules.dto.SettlementQueryDTO;
import com.handcraft.platform.modules.entity.OrderSettlement;
import java.util.List;
import org.apache.ibatis.annotations.*;
/** 结算只读查询：创作者仅本人记录，管理员按状态与订单号筛选；不改写资金快照。 */
@Mapper
public interface OrderSettlementMapper {
    /** 创作者筛选仅含状态；管理员筛选另有订单号，两 DTO 字段不同须分开常量。 */
    /** 创作者条件置于 where 元素内，避免与状态筛选生成重复 WHERE。 */
    String CREATOR_FILTER="""
        <where>o.creator_id=#{userId}
          <if test='q.status != null and q.status != "ALL"'>AND s.status=#{q.status}</if>
        </where>
        """;
    String ADMIN_FILTER="""
        <where>
          <if test='q.status != null and q.status != "ALL"'>AND s.status=#{q.status}</if>
          <if test='q.orderNo != null and q.orderNo != ""'>AND LOCATE(#{q.orderNo},o.order_no)>0</if>
          <if test='q.createdFrom != null'>AND s.created_at&gt;=#{q.createdFrom}</if>
          <if test='q.createdTo != null'>AND s.created_at&lt;=#{q.createdTo}</if>
          <if test='q.minAmount != null'>AND s.paid_amount&gt;=#{q.minAmount}</if>
          <if test='q.maxAmount != null'>AND s.paid_amount&lt;=#{q.maxAmount}</if>
        </where>
        """;
    @Select("<script>SELECT s.* FROM order_settlement s JOIN trade_order o ON o.id=s.order_id "+CREATOR_FILTER+" ORDER BY s.id DESC LIMIT #{q.size} OFFSET #{offset}</script>")
    List<OrderSettlement> listForCreator(@Param("userId")Long userId,@Param("q")SettlementQueryDTO q,@Param("offset")int offset);
    @Select("<script>SELECT COUNT(*) FROM order_settlement s JOIN trade_order o ON o.id=s.order_id "+CREATOR_FILTER+"</script>")
    long countForCreator(@Param("userId")Long userId,@Param("q")SettlementQueryDTO q);
    @Select("<script>SELECT s.* FROM order_settlement s JOIN trade_order o ON o.id=s.order_id "+ADMIN_FILTER+" ORDER BY s.id DESC LIMIT #{q.size} OFFSET #{offset}</script>")
    List<OrderSettlement> listForAdmin(@Param("q")AdminSettlementQueryDTO q,@Param("offset")int offset);
    @Select("<script>SELECT COUNT(*) FROM order_settlement s JOIN trade_order o ON o.id=s.order_id "+ADMIN_FILTER+"</script>")
    long countForAdmin(@Param("q")AdminSettlementQueryDTO q);
}
