package com.handcraft.platform.modules.entity;
import lombok.Getter;
import lombok.Setter;
/** 互动业务读取与写入所需字段。 */
@Getter @Setter
public class InteractionComment {
 /** 评论编号。 */
 private Long id;
 /** 作品编号。 */
 private Long workId;
 /** 评论作者编号。 */
 private Long authorId;
 /** 评论正文。 */
 private String content;
 /** 图片编号数组。 */
 private String imageIds;
 /** 发表时间。 */
 private java.time.LocalDateTime createdAt;
 /** 作者删除时间。 */
 private java.time.LocalDateTime userDeletedAt;
 /** 治理状态。 */
 private String moderationStatus;
}
