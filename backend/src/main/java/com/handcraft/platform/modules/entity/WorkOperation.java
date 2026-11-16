package com.handcraft.platform.modules.entity;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;
/** 操作记录只追加，作品快照不随当前正文变化。 */
@Getter @Setter
public class WorkOperation {
    /** 操作编号。 */ private Long id;
    /** 操作人。 */ private Long operatorId;
    /** USER或ADMIN。 */ private String operatorType;
    /** 操作动作。 */ private String action;
    /** 变更前状态。 */ private String beforeStatus;
    /** 变更后状态。 */ private String afterStatus;
    /** 人工原因。 */ private String reason;
    /** 不可变JSON详情。 */ private String detail;
    /** 创建时间。 */ private LocalDateTime createdAt;
}
