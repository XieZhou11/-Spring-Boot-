package com.handcraft.platform.modules.mapper;

import com.handcraft.platform.modules.entity.FileAsset;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** 文件状态只在行锁保护下变更；曾 AVAILABLE 的对象不进入失败上传清理。 */
@Mapper
public interface FileAssetMapper {
    String COLUMNS = "id,uploader_id,object_key,content_type,byte_size,upload_status,created_at,updated_at";

    @Insert("INSERT INTO file_asset(uploader_id,object_key,content_type,byte_size,upload_status) "
            + "VALUES(#{uploaderId},#{objectKey},#{contentType},#{byteSize},'UPLOADING')")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(FileAsset file);

    @Select("SELECT " + COLUMNS + " FROM file_asset WHERE id=#{id}")
    FileAsset findById(Long id);

    @Select("SELECT " + COLUMNS + " FROM file_asset WHERE id=#{id} FOR UPDATE")
    FileAsset lockById(Long id);

    @Update("UPDATE file_asset SET upload_status=#{status} WHERE id=#{id}")
    int updateStatus(@Param("id") Long id, @Param("status") String status);

    @Select("SELECT " + COLUMNS + " FROM file_asset WHERE object_key LIKE 'avatars/%' AND "
            + "(upload_status='CLEANUP_PENDING' OR (upload_status='UPLOADING' "
            + "AND updated_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 HOUR))) ORDER BY updated_at,id LIMIT 50")
    List<FileAsset> findInterruptedAvatars();

    @Select("SELECT COUNT(*) FROM user_account WHERE avatar_file_id=#{fileId}")
    int countAvatarReferences(Long fileId);

    /** SDK 最长单次请求为 30 秒；保留两分钟稳定窗口，覆盖远端迟到 PUT 后再次删除。 */
    @Select("SELECT updated_at <= DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 2 MINUTE) FROM file_asset WHERE id=#{fileId}")
    boolean cleanupWindowElapsed(Long fileId);

    /** 仅扫描入驻临时资源，所有历史材料的引用在清理事务中再次检查。 */
    @Select("SELECT "+COLUMNS+" FROM file_asset f WHERE object_key LIKE 'creator-applications/%' AND (upload_status='CLEANUP_PENDING' OR (upload_status='UPLOADING' AND updated_at < DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 HOUR)) OR (upload_status='AVAILABLE' AND updated_at < DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 24 HOUR) AND NOT EXISTS (SELECT 1 FROM creator_application a WHERE a.user_id=f.uploader_id AND JSON_SEARCH(a.original_works,'one',CAST(f.id AS CHAR),NULL,'$[*].finished_image_ids[*]','$[*].process_image_ids[*]') IS NOT NULL))) ORDER BY updated_at,id LIMIT 50")
    List<FileAsset> findInterruptedApplications();

    @Select("SELECT (upload_status='CLEANUP_PENDING' OR (upload_status='UPLOADING' AND updated_at < DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 HOUR)) OR (upload_status='AVAILABLE' AND updated_at < DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 24 HOUR))) FROM file_asset WHERE id=#{fileId}")
    boolean applicationCleanupDue(Long fileId);
    /** 扫描时排除所有当前与历史引用，避免旧引用填满批次导致孤儿资源饥饿。 */
    @Select("SELECT "+COLUMNS+" "+"""
        FROM file_asset f
        WHERE object_key LIKE 'works/%' AND (
            upload_status='CLEANUP_PENDING'
            OR (upload_status='UPLOADING' AND updated_at < DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 HOUR))
            OR (
                upload_status='AVAILABLE' AND updated_at < DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 24 HOUR)
                AND NOT EXISTS (
                    SELECT 1 FROM work w WHERE w.creator_id=f.uploader_id AND (
                        JSON_CONTAINS(w.main_image_ids,JSON_QUOTE(CAST(f.id AS CHAR)))
                        OR JSON_CONTAINS(w.specification_image_ids,JSON_QUOTE(CAST(f.id AS CHAR)))
                    )
                )
                AND NOT EXISTS (
                    SELECT 1 FROM operation_log l JOIN work w ON l.target_type='WORK' AND l.target_id=w.id
                    WHERE w.creator_id=f.uploader_id AND JSON_SEARCH(l.detail,'one',CAST(f.id AS CHAR),NULL,
                    '$.snapshot.mainImageIds[*]','$.snapshot.specificationImageIds[*]',
                    '$.before.mainImageIds[*]','$.before.specificationImageIds[*]',
                    '$.after.mainImageIds[*]','$.after.specificationImageIds[*]') IS NOT NULL
                )
            )
        ) ORDER BY updated_at,id LIMIT 100
        """)
    List<FileAsset> findInterruptedWorks();

    /** 扫描排除全部历史引用；事务内仍需复查，避免保存与清理竞争。 */
    @Select("SELECT "+COLUMNS+" "+"""
        FROM file_asset f WHERE (object_key LIKE 'custom-requests/%' OR object_key LIKE 'conversations/%') AND (
            upload_status='CLEANUP_PENDING'
            OR (upload_status='UPLOADING' AND updated_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 HOUR))
            OR (upload_status='AVAILABLE' AND updated_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 24 HOUR)
                AND NOT EXISTS (SELECT 1 FROM custom_request r WHERE JSON_CONTAINS(r.reference_image_ids,JSON_QUOTE(CAST(f.id AS CHAR))))
                AND NOT EXISTS (SELECT 1 FROM operation_log l WHERE l.target_type='CUSTOM_REQUEST' AND JSON_SEARCH(l.detail,'one',CAST(f.id AS CHAR),NULL,'$.snapshot.referenceImageIds[*]') IS NOT NULL)
                AND NOT EXISTS (SELECT 1 FROM chat_message m WHERE JSON_CONTAINS(m.image_ids,JSON_QUOTE(CAST(f.id AS CHAR))))
            )
        ) ORDER BY updated_at,id LIMIT 100
        """)
    List<FileAsset> findInterruptedRequests();

    /** 报价历史和订单快照一并排除，防止旧引用占满扫描批次或被误清理。 */
    @Select("SELECT "+COLUMNS+" "+"""
        FROM file_asset f WHERE object_key LIKE 'quotes/%' AND (
            upload_status='CLEANUP_PENDING'
            OR (upload_status='UPLOADING' AND updated_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 1 HOUR))
            OR (upload_status='AVAILABLE' AND updated_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 24 HOUR))
        )
        AND NOT EXISTS (SELECT 1 FROM quote q WHERE JSON_CONTAINS(q.image_ids,JSON_QUOTE(CAST(f.id AS CHAR))))
        AND NOT EXISTS (SELECT 1 FROM trade_order o WHERE JSON_CONTAINS(o.agreement_snapshot,JSON_QUOTE(CAST(f.id AS CHAR)),'$.imageIds'))
        ORDER BY updated_at,id LIMIT 100
        """)
    List<FileAsset> findInterruptedQuotes();
}
