package com.handcraft.platform.modules.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** 不按报价或订单当前状态过滤，撤回、落选、取消和退款后的证据仍保留。 */
@Mapper
public interface QuoteImageMapper {
    @Select("""
        SELECT EXISTS (
            SELECT 1 FROM quote q JOIN custom_request r ON r.id=q.request_id
            WHERE (q.creator_id=#{userId} OR r.buyer_id=#{userId})
              AND JSON_CONTAINS(q.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR)))
        ) OR EXISTS (
            SELECT 1 FROM trade_order o
            WHERE (o.creator_id=#{userId} OR o.buyer_id=#{userId})
              AND JSON_CONTAINS(o.agreement_snapshot,JSON_QUOTE(CAST(#{fileId} AS CHAR)),'$.imageIds')
        )
        """)
    boolean readable(@Param("userId") Long userId, @Param("fileId") Long fileId);

    @Select("""
        SELECT EXISTS (
            SELECT 1 FROM quote q WHERE JSON_CONTAINS(q.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR)))
        ) OR EXISTS (
            SELECT 1 FROM trade_order o
            WHERE JSON_CONTAINS(o.agreement_snapshot,JSON_QUOTE(CAST(#{fileId} AS CHAR)),'$.imageIds')
        )
        """)
    boolean referenced(Long fileId);
}
