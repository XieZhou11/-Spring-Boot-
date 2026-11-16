package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
import java.util.Map;
/** 仅本人及管理员可查的不可变作品历史。 */
public record WorkHistoryVO(
    /** 操作记录编号。 */
    String id,
    /** 动作。 */
    String action,
    /** 原审核状态。 */
    String beforeStatus,
    /** 新审核状态。 */
    String afterStatus,
    /** 审核或下架原因。 */
    String reason,
    /** 操作用户编号。 */
    String operatorId,
    /** USER或ADMIN。 */
    String operatorType,
    /** 操作北京时间。 */
    OffsetDateTime createdAt,
    /** 内容快照及修改前后值，submittedVersion定位提交轮次。 */
    Map<String,Object> detail) {}
