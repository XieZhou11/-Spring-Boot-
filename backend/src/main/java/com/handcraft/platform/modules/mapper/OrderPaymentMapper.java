package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.*;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 支付行锁由订单业务持有，唯一键保护每单每类成功流水及五节点。 */
@Mapper
public interface OrderPaymentMapper {
    @Select("SELECT * FROM fund_flow WHERE order_id=#{id} AND flow_type='PAYMENT' AND result='SUCCESS'")
    FundFlow payment(Long id);
    @Insert("INSERT INTO fund_flow(flow_no,order_id,flow_type,amount,result,idempotency_key,occurred_at) VALUES(#{flowNo},#{orderId},'PAYMENT',#{amount},'SUCCESS',#{idempotencyKey},#{occurredAt})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insertPayment(FundFlow flow);
    @Select("SELECT * FROM order_settlement WHERE order_id=#{id}")
    OrderSettlement settlement(Long id);
    @Insert("INSERT INTO order_settlement(order_id,paid_amount,payee_snapshot,status,created_at,updated_at) VALUES(#{orderId},#{paidAmount},#{payeeSnapshot},'PENDING',#{createdAt},#{createdAt})")
    int insertSettlement(OrderSettlement settlement);
    @Select("SELECT * FROM order_progress_node WHERE order_id=#{id} ORDER BY sort_order")
    List<OrderProgressNode> nodes(Long id);
    @Insert("INSERT INTO order_progress_node(order_id,node_code,sort_order,planned_finish_date,status,created_at,updated_at) VALUES(#{orderId},#{nodeCode},#{sortOrder},#{plannedFinishDate},'NOT_STARTED',#{createdAt},#{createdAt})")
    int insertNode(OrderProgressNode node);
}
