package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.Quote;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 需求行锁串行化五份额度，用户行锁串行化每日额度及提交请求键。 */
@Mapper
public interface QuoteMapper {
    String EFFECTIVE="CASE WHEN status='ACTIVE' AND expires_at &lt;= #{now} THEN 'EXPIRED' ELSE status END";
    @Select("SELECT * FROM quote WHERE id=#{id}") Quote find(Long id);
    @Select("SELECT * FROM quote WHERE creator_id=#{creatorId} AND create_request_key=#{key}")
    Quote findKey(@Param("creatorId") Long creatorId,@Param("key") String key);
    @Select("SELECT * FROM quote WHERE request_id=#{requestId} ORDER BY id FOR UPDATE")
    @Options(flushCache=Options.FlushCachePolicy.TRUE)
    List<Quote> lockForRequest(Long requestId);
    @Select("SELECT * FROM quote WHERE request_id=#{requestId} AND status='ACTIVE' AND expires_at>#{now} ORDER BY id")
    List<Quote> active(@Param("requestId") Long requestId,@Param("now") LocalDateTime now);
    @Select("SELECT COUNT(*) FROM quote WHERE creator_id=#{creatorId} AND created_at>=#{start} AND created_at<#{end}")
    long daily(@Param("creatorId") Long creatorId,@Param("start") LocalDateTime start,@Param("end") LocalDateTime end);
    @Insert("""
        INSERT INTO quote(request_id,creator_id,create_request_key,goods_amount,duration_days,proposal,additional_agreement,image_ids,status,expires_at,created_at,updated_at)
        VALUES(#{requestId},#{creatorId},#{createRequestKey},#{goodsAmount},#{durationDays},#{proposal},#{additionalAgreement},#{imageIds},'ACTIVE',#{expiresAt},#{createdAt},#{updatedAt})
        """)
    @Options(useGeneratedKeys=true,keyProperty="id") int insert(Quote quote);
    @Update("UPDATE quote SET status=#{status},invalid_reason=#{invalidReason},invalidated_at=#{invalidatedAt},updated_at=#{updatedAt} WHERE id=#{id} AND status='ACTIVE'")
    int transition(Quote quote);
    /** 定标时只有在同一业务时点仍有效的报价能写为中标或落选。 */
    @Update("""
        UPDATE quote SET status=#{status},updated_at=#{awardAt}
        WHERE id=#{quoteId} AND request_id=#{requestId} AND status='ACTIVE' AND expires_at>#{awardAt}
        """)
    int resolveForAward(@Param("requestId") Long requestId,@Param("quoteId") Long quoteId,
                        @Param("status") String status,@Param("awardAt") LocalDateTime awardAt);
    String FILTER="""
        <where>
        <if test='creatorId != null'>AND creator_id=#{creatorId}</if>
        <if test='requestId != null'>AND request_id=#{requestId}</if>
        <if test='status != null and status != "ALL"'>AND (
        """+EFFECTIVE+")=#{status}</if></where>";
    @Select("<script>SELECT * FROM quote "+FILTER+" ORDER BY created_at DESC,id DESC LIMIT #{size} OFFSET #{offset}</script>")
    List<Quote> list(@Param("creatorId") Long creatorId,@Param("requestId") Long requestId,@Param("status") String status,@Param("now") LocalDateTime now,@Param("offset") int offset,@Param("size") int size);
    @Select("<script>SELECT COUNT(*) FROM quote "+FILTER+"</script>")
    long count(@Param("creatorId") Long creatorId,@Param("requestId") Long requestId,@Param("status") String status,@Param("now") LocalDateTime now);
    @Select("SELECT DISTINCT request_id FROM quote WHERE status='ACTIVE' AND expires_at<=#{now} ORDER BY request_id LIMIT 100")
    List<Long> dueRequests(LocalDateTime now);
}
