package com.handcraft.platform.modules.entity;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/** 私有 OSS 元数据，数据库只存对象键，不保存短时签名地址。 */
@Getter
@Setter
public class FileAsset {
    /** 数据库生成的文件编号。 */
    private Long id;
    /** 实际上传人的账号编号。 */
    private Long uploaderId;
    /** 随机且唯一的 OSS 对象键，不包含原文件名和个人资料。 */
    private String objectKey;
    /** 经图片解码确认的 MIME 类型。 */
    private String contentType;
    /** 实际文件字节数。 */
    private Integer byteSize;
    /** 上传状态：UPLOADING、AVAILABLE、CLEANUP_PENDING、DELETED。 */
    private String uploadStatus;
    /** 元数据创建时间。 */
    private LocalDateTime createdAt;
    /** 状态最近更新时间，供中断上传恢复使用。 */
    private LocalDateTime updatedAt;
}
