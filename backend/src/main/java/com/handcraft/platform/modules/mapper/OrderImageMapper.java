package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.FileAsset;
import com.handcraft.platform.modules.entity.TradeOrder;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 图片绑定和回收共享用户→需求→订单→文件锁序，历史引用不按订单当前状态过滤。 */
@Mapper
public interface OrderImageMapper {
    /** 订单别名为 o，文件别名为 f。仅匹配快照根数组里的字符串编号。 */
    String STOCK_SNAPSHOT_HAS_FILE = """
        o.order_type='STOCK' AND o.creator_id=f.uploader_id AND (
            (JSON_TYPE(JSON_EXTRACT(o.agreement_snapshot,'$.mainImageIds'))='ARRAY'
              AND JSON_OVERLAPS(JSON_EXTRACT(o.agreement_snapshot,'$.mainImageIds'),JSON_ARRAY(CAST(f.id AS CHAR))))
            OR (JSON_TYPE(JSON_EXTRACT(o.agreement_snapshot,'$.specificationImageIds'))='ARRAY'
              AND JSON_OVERLAPS(JSON_EXTRACT(o.agreement_snapshot,'$.specificationImageIds'),JSON_ARRAY(CAST(f.id AS CHAR))))
        )
        """;

    @Select("SELECT * FROM trade_order WHERE id=#{id}")
    TradeOrder order(Long id);

    /** 按成交快照查找本单创作者上传的可用作品图片。 */
    @Select("""
        SELECT f.* FROM trade_order o JOIN file_asset f ON f.id=#{fileId}
        WHERE o.id=#{orderId} AND f.upload_status='AVAILABLE'
          AND f.object_key LIKE CONCAT('works/',o.creator_id,'/%')
          AND
        """ + STOCK_SNAPSHOT_HAS_FILE)
    FileAsset stockSnapshotImage(@Param("orderId") Long orderId,@Param("fileId") Long fileId);

    @Select("SELECT id FROM custom_request WHERE id=#{id} FOR UPDATE")
    Long lockRequest(Long id);

    @Select("SELECT * FROM trade_order WHERE id=#{id} FOR UPDATE")
    @Options(flushCache=Options.FlushCachePolicy.TRUE)
    TradeOrder lockOrder(Long id);

    @Select("SELECT started_at IS NULL FROM trade_order WHERE id=#{id}")
    boolean unstarted(Long id);

    /** 处理中申请允许双方为当前售后上传，历史终局不会重新打开上传资格。 */
    @Select("SELECT EXISTS(SELECT 1 FROM refund_application WHERE order_id=#{id} AND application_type='NORMAL' AND status='WAIT_ADMIN')")
    boolean normalRefundPending(Long id);

    /** 同一订单固定节点所属关系不可变，历史打卡和补充均赋予双方读取权。 */
    @Select("""
        SELECT EXISTS (SELECT 1 FROM order_progress_record r
            JOIN order_progress_node n ON n.id=r.node_id JOIN trade_order o ON o.id=n.order_id
            WHERE (o.buyer_id=#{userId} OR o.creator_id=#{userId})
              AND JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))
        OR EXISTS (SELECT 1 FROM refund_application r JOIN trade_order o ON o.id=r.order_id
            WHERE (o.buyer_id=#{userId} OR o.creator_id=#{userId})
              AND JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))
        OR EXISTS (SELECT 1 FROM refund_evidence e JOIN refund_application r ON r.id=e.refund_application_id
            JOIN trade_order o ON o.id=r.order_id WHERE (o.buyer_id=#{userId} OR o.creator_id=#{userId})
              AND JSON_CONTAINS(e.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))
        """)
    boolean readable(@Param("userId") Long userId,@Param("fileId") Long fileId);

    @Select("""
        SELECT EXISTS (SELECT 1 FROM order_progress_record r
            WHERE JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))
        OR EXISTS (SELECT 1 FROM refund_application r
            WHERE JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))
        OR EXISTS (SELECT 1 FROM refund_evidence e
            WHERE JSON_CONTAINS(e.image_ids,JSON_QUOTE(CAST(#{fileId} AS CHAR))))
        """)
    boolean referenced(Long fileId);

    /** 扫描即排除全部历史引用，避免旧证据占满每批导致临时文件无法回收。 */
    @Select("SELECT "+FileAssetMapper.COLUMNS+" "+"""
        FROM file_asset f WHERE (object_key LIKE 'order-progress/%' OR object_key LIKE 'order-refunds/%')
        AND (upload_status='CLEANUP_PENDING'
            OR (upload_status='UPLOADING' AND updated_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 HOUR))
            OR (upload_status='AVAILABLE' AND updated_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 24 HOUR)))
        AND NOT EXISTS (SELECT 1 FROM order_progress_record r WHERE JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(f.id AS CHAR))))
        AND NOT EXISTS (SELECT 1 FROM refund_application r WHERE JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(f.id AS CHAR))))
        AND NOT EXISTS (SELECT 1 FROM refund_evidence e WHERE JSON_CONTAINS(e.image_ids,JSON_QUOTE(CAST(f.id AS CHAR))))
        ORDER BY updated_at,id LIMIT 100
        """)
    List<FileAsset> cleanupCandidates();
}
