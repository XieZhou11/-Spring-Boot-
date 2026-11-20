package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
import java.util.Map;
/** @param id 历史编号 @param operatorId 操作者编号 @param operatorType 操作者身份 @param action 动作
 * @param beforeStatus 原状态 @param afterStatus 新状态 @param reason 处理依据 @param detail 必要核验事实 @param createdAt 原记录时刻 */
public record AdminRefundHistoryVO(String id,String operatorId,String operatorType,String action,String beforeStatus,String afterStatus,String reason,Map<String,Object> detail,OffsetDateTime createdAt) {}
