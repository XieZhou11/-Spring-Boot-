package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.TradeOrder;
import com.handcraft.platform.modules.entity.WorkOperation;
import com.handcraft.platform.modules.dto.OrderQueryDTO;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 唯一需求和请求键约束保护建单，状态条件更新保护取消。 */
@Mapper
public interface TradeOrderMapper {
    String EFFECTIVE="CASE WHEN status='PENDING_PAY' AND pay_deadline_at &lt;= #{now} THEN 'CANCELLED' ELSE status END";
    @Select("SELECT * FROM trade_order WHERE id=#{id}") TradeOrder find(Long id);
    @Select("SELECT * FROM trade_order WHERE id=#{id} FOR UPDATE")
    @Options(flushCache=Options.FlushCachePolicy.TRUE) TradeOrder lock(Long id);
    /** 仅列出本人作为创作者且买家已同意的定制订单，供案例手动关联。 */
    @Select("SELECT * FROM trade_order WHERE creator_id=#{creatorId} AND order_type='CUSTOM' AND publication_consent_status='APPROVED' ORDER BY publication_responded_at DESC,id DESC")
    List<TradeOrder> approvedPublicationOrders(Long creatorId);
    @Select("SELECT * FROM trade_order WHERE buyer_id=#{buyerId} AND create_request_key=#{key}")
    TradeOrder findKey(@Param("buyerId") Long buyerId,@Param("key") String key);
    @Select("SELECT * FROM trade_order WHERE request_id=#{requestId}") TradeOrder byRequest(Long requestId);
    @Insert("""
        INSERT INTO trade_order(order_no,order_type,buyer_id,creator_id,request_id,quote_id,status,title_snapshot,total_amount,duration_days,agreement_snapshot,address_snapshot,pay_deadline_at,create_request_key,created_at,updated_at)
        VALUES(#{orderNo},'CUSTOM',#{buyerId},#{creatorId},#{requestId},#{quoteId},'PENDING_PAY',#{titleSnapshot},#{totalAmount},#{durationDays},#{agreementSnapshot},#{addressSnapshot},#{payDeadlineAt},#{createRequestKey},#{createdAt},#{updatedAt})
        """)
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(TradeOrder order);
    /** 现货建单保存单件作品编号；需求与报价关联字段保持为空。 */
    @Insert("INSERT INTO trade_order(order_no,order_type,buyer_id,creator_id,work_id,status,title_snapshot,total_amount,agreement_snapshot,address_snapshot,pay_deadline_at,create_request_key,created_at,updated_at) VALUES(#{orderNo},'STOCK',#{buyerId},#{creatorId},#{workId},'PENDING_PAY',#{titleSnapshot},#{totalAmount},#{agreementSnapshot},#{addressSnapshot},#{payDeadlineAt},#{createRequestKey},#{createdAt},#{updatedAt})")
    @Options(useGeneratedKeys=true,keyProperty="id") int insertStock(TradeOrder order);
    @Update("UPDATE trade_order SET status='CANCELLED',updated_at=#{now} WHERE id=#{id} AND status='PENDING_PAY'")
    int cancel(@Param("id") Long id,@Param("now") LocalDateTime now);
    /** 调用方锁后检查截止及需求状态，条件更新不覆盖取消或已付款结果。 */
    @Update("UPDATE trade_order SET status=#{status},paid_at=#{paidAt},terms_confirmed_at=#{termsConfirmedAt},ship_deadline_at=#{shipDeadlineAt},updated_at=#{updatedAt} WHERE id=#{id} AND order_type=#{orderType} AND status='PENDING_PAY'")
    int pay(TradeOrder order);
    /** 订单持有行锁后原子落授权状态，条件状态避免覆盖并发回复。 */
    @Update("UPDATE trade_order SET publication_consent_status=#{publicationConsentStatus},publication_requested_at=#{publicationRequestedAt},publication_responded_at=#{publicationRespondedAt},updated_at=CURRENT_TIMESTAMP(3) WHERE id=#{id} AND publication_consent_status=#{expectedConsentStatus}")
    int updatePublicationConsent(TradeOrder order);
    String FILTER="""
        <where>
        <choose><when test='query.side == "CREATOR"'>creator_id=#{userId}</when><otherwise>buyer_id=#{userId}</otherwise></choose>
        <if test='query.status != null and query.status != "ALL"'>AND (
        """+EFFECTIVE+")=#{query.status}</if></where>";
    @Select("<script>SELECT * FROM trade_order "+FILTER+" ORDER BY created_at DESC,id DESC LIMIT #{query.size} OFFSET #{offset}</script>")
    List<TradeOrder> list(@Param("userId") Long userId,@Param("query") OrderQueryDTO query,@Param("now") LocalDateTime now,@Param("offset") int offset);
    @Select("<script>SELECT COUNT(*) FROM trade_order "+FILTER+"</script>")
    long count(@Param("userId") Long userId,@Param("query") OrderQueryDTO query,@Param("now") LocalDateTime now);
    @Select("SELECT * FROM operation_log WHERE target_type='ORDER' AND target_id=#{id} ORDER BY id")
    List<WorkOperation> history(Long id);
    @Select("SELECT id FROM trade_order WHERE status='PENDING_PAY' AND pay_deadline_at<=#{now} ORDER BY id LIMIT 100")
    List<Long> due(LocalDateTime now);

    /** 订单参考图按不可变快照与双方身份授权，不依赖当前接单资格或订单状态。 */
    @Select("""
        SELECT EXISTS (SELECT 1 FROM trade_order
          WHERE order_type='CUSTOM' AND (buyer_id=#{userId} OR creator_id=#{userId})
            AND JSON_CONTAINS(agreement_snapshot,JSON_QUOTE(CAST(#{fileId} AS CHAR)),'$.request.referenceImageIds'))
        """)
    boolean requestImageReadable(@Param("userId") Long userId,@Param("fileId") Long fileId);

    /** 历史订单快照中的需求参考图始终保留。 */
    @Select("""
        SELECT EXISTS (SELECT 1 FROM trade_order WHERE order_type='CUSTOM'
          AND JSON_CONTAINS(agreement_snapshot,JSON_QUOTE(CAST(#{fileId} AS CHAR)),'$.request.referenceImageIds'))
        """)
    boolean requestImageReferenced(Long fileId);
}
