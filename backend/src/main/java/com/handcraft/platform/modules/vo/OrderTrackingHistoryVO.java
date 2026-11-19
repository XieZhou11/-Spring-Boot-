package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
/** @param id 操作记录编号
 * @param requestKey 原更正请求键
 * @param oldTrackingNo 原运单号
 * @param newTrackingNo 更正后运单号
 * @param operatorId 更正操作者编号
 * @param createdAt 更正服务器时刻 */
public record OrderTrackingHistoryVO(String id,String requestKey,String oldTrackingNo,String newTrackingNo,String operatorId,OffsetDateTime createdAt){}
