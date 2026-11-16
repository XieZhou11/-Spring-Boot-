package com.handcraft.platform.modules.entity;
import lombok.Getter;
import lombok.Setter;
/** 互动业务读取与写入所需字段。 */
@Getter @Setter
public class InteractionWork {
 /** 作品编号。 */
 private Long id;
 /** 作者编号。 */
 private Long creatorId;
 /** 公开标题。 */
 private String title;
 /** 主图编号数组。 */
 private String mainImageIds;
 /** 审核状态。 */
 private String reviewStatus;
 /** 逻辑删除时间。 */
 private java.time.LocalDateTime deletedAt;
}
