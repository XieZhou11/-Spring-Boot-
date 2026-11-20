package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.FileAsset;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 评论图片引用独立于作品和入驻用途；清理必须保留隐藏及自删评论证据。 */
@Mapper
public interface CommentImageMapper {
    @Select("SELECT (SELECT COUNT(*) FROM work_comment WHERE JSON_CONTAINS(image_ids,JSON_QUOTE(CAST(#{id} AS CHAR))))+(SELECT COUNT(*) FROM order_review WHERE JSON_CONTAINS(image_ids,JSON_QUOTE(CAST(#{id} AS CHAR))))+(SELECT COUNT(*) FROM report WHERE JSON_CONTAINS(image_ids,JSON_QUOTE(CAST(#{id} AS CHAR))))+(SELECT COUNT(*) FROM report_evidence WHERE JSON_CONTAINS(image_ids,JSON_QUOTE(CAST(#{id} AS CHAR))))")
    int references(Long id);

    @Select("SELECT (SELECT COUNT(*) FROM work_comment c JOIN work w ON w.id=c.work_id WHERE c.user_deleted_at IS NULL AND c.moderation_status='VISIBLE' AND w.review_status='ONLINE' AND w.deleted_at IS NULL AND JSON_CONTAINS(c.image_ids,JSON_QUOTE(CAST(#{id} AS CHAR))))+(SELECT COUNT(*) FROM order_review r JOIN trade_order o ON o.id=r.order_id WHERE r.moderation_status='VISIBLE' AND o.status<>'REFUNDED' AND JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(#{id} AS CHAR))))")
    int publicReferences(Long id);

    /** 扫描阶段先排除历史引用，避免受保护资源占满批次。 */
    @Select("SELECT "+FileAssetMapper.COLUMNS+" FROM file_asset f WHERE object_key LIKE 'work-comments/%' AND (upload_status='CLEANUP_PENDING' OR (upload_status='UPLOADING' AND updated_at < DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 HOUR)) OR (upload_status='AVAILABLE' AND updated_at < DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 24 HOUR) AND NOT EXISTS (SELECT 1 FROM work_comment c WHERE JSON_CONTAINS(c.image_ids,JSON_QUOTE(CAST(f.id AS CHAR)))) AND NOT EXISTS (SELECT 1 FROM order_review r WHERE JSON_CONTAINS(r.image_ids,JSON_QUOTE(CAST(f.id AS CHAR)))) AND NOT EXISTS (SELECT 1 FROM report x WHERE JSON_CONTAINS(x.image_ids,JSON_QUOTE(CAST(f.id AS CHAR)))) AND NOT EXISTS (SELECT 1 FROM report_evidence e WHERE JSON_CONTAINS(e.image_ids,JSON_QUOTE(CAST(f.id AS CHAR)))))) ORDER BY updated_at,id LIMIT 100")
    List<FileAsset> cleanupCandidates();
}
