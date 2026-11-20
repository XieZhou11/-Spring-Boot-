package com.handcraft.platform.modules.mapper;
import com.handcraft.platform.modules.entity.*;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;
/** 普通售后访问遵守账号→需求→订单→申请→结算→节点→会话→文件锁序。 */
@Mapper
public interface RefundApplicationMapper {
    @Select("SELECT * FROM refund_application WHERE id=#{id}") RefundApplication find(Long id);
    @Select("SELECT * FROM refund_application WHERE id=#{id} FOR UPDATE") @Options(flushCache=Options.FlushCachePolicy.TRUE) RefundApplication lock(Long id);
    @Select("SELECT * FROM refund_application WHERE buyer_id=#{actor} AND create_request_key=#{key}") RefundApplication byCreateKey(@Param("actor")Long actor,@Param("key")String key);
    @Select("SELECT * FROM refund_application WHERE order_id=#{id} AND status='WAIT_ADMIN' FOR UPDATE") @Options(flushCache=Options.FlushCachePolicy.TRUE) RefundApplication pending(Long id);
    @Select("SELECT * FROM refund_application WHERE order_id=#{id} AND status='WAIT_ADMIN' ORDER BY id LIMIT 1") RefundApplication current(Long id);
    @Select("SELECT * FROM refund_application WHERE order_id=#{id} ORDER BY created_at,id LIMIT #{limit} OFFSET #{offset}") List<RefundApplication> history(@Param("id")Long id,@Param("limit")int limit,@Param("offset")long offset);
    @Select("SELECT COUNT(*) FROM refund_application WHERE order_id=#{id}") long count(Long id);
    @Insert("INSERT INTO refund_application(order_id,buyer_id,application_type,original_order_status,reason_code,description,image_ids,status,create_request_key,version,created_at,updated_at) VALUES(#{orderId},#{buyerId},#{applicationType},#{originalOrderStatus},#{reasonCode},#{description},#{imageIds},#{status},#{createRequestKey},0,#{createdAt},#{createdAt})") @Options(useGeneratedKeys=true,keyProperty="id") int insert(RefundApplication value);
    @Update("UPDATE refund_application SET status=#{status},finished_at=#{finishedAt},decision_reason=#{decisionReason},handler_id=#{handlerId},updated_at=#{finishedAt} WHERE id=#{id} AND status='WAIT_ADMIN'") int updateTerminal(RefundApplication value);
    @Update("UPDATE refund_application SET version=version+1,updated_at=#{now} WHERE id=#{id} AND status='WAIT_ADMIN'") int incrementVersion(@Param("id")Long id,@Param("now")LocalDateTime now);
    @Select("SELECT * FROM refund_evidence WHERE submitter_id=#{actor} AND request_key=#{key}") RefundEvidence evidenceByKey(@Param("actor")Long actor,@Param("key")String key);
    @Select("SELECT * FROM refund_evidence WHERE refund_application_id=#{id} AND id>#{after} ORDER BY id LIMIT #{limit}") List<RefundEvidence> evidence(@Param("id")Long id,@Param("after")long after,@Param("limit")int limit);
    @Select("SELECT * FROM refund_evidence WHERE refund_application_id=#{id} ORDER BY id") List<RefundEvidence> allEvidence(Long id);
    @Insert("INSERT INTO refund_evidence(refund_application_id,submitter_id,request_key,content,image_ids,created_at) VALUES(#{refundApplicationId},#{submitterId},#{requestKey},#{content},#{imageIds},#{createdAt})") @Options(useGeneratedKeys=true,keyProperty="id") int insertEvidence(RefundEvidence value);
}
