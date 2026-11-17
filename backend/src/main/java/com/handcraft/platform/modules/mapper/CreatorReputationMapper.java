package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.vo.CreatorReputationVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/** 单条查询读取同一快照，隐藏、删除、孤立或全额退款评价不进入公开口碑。 */
@Mapper
public interface CreatorReputationMapper {
    @Select("""
        SELECT CAST(CAST(ROUND(AVG(r.rating),1) AS DECIMAL(2,1)) AS CHAR) AS averageRating,
               COUNT(*) AS reviewCount,
               (SELECT COUNT(*) FROM trade_order completed
                WHERE completed.creator_id=#{creatorId} AND completed.original_completed_at IS NOT NULL
                  AND completed.status<>'REFUNDED') AS completedOrderCount,
               CAST(ROUND(100.0*SUM(r.rating>=4)/NULLIF(COUNT(*),0),1) AS CHAR) AS positiveRate
        FROM order_review r JOIN trade_order o
          ON o.id=r.order_id AND o.creator_id=r.creator_id AND o.buyer_id=r.buyer_id
        WHERE r.creator_id=#{creatorId} AND r.moderation_status='VISIBLE'
          AND o.original_completed_at IS NOT NULL AND o.status<>'REFUNDED'
        """)
    CreatorReputationVO summary(Long creatorId);
}
