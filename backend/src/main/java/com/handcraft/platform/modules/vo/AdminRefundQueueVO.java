package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
/** @param id 申请编号 @param orderId 订单编号 @param orderNo 对外订单号 @param orderType 订单类型（现货或定制） @param title 订单标题
 * @param buyerId 申请买家 @param creatorId 创作者 @param applicationType 申请类型
 * @param originalOrderStatus 原订单状态 @param reasonCode 申请原因 @param status 当前申请状态
 * @param version 补证版本 @param createdAt 申请时刻 @param finishedAt 结束时刻 @param totalAmount 原成交金额 */
public record AdminRefundQueueVO(String id,String orderId,String orderNo,String orderType,String title,String buyerId,String creatorId,String applicationType,String originalOrderStatus,String reasonCode,String status,long version,OffsetDateTime createdAt,OffsetDateTime finishedAt,String totalAmount) {}
