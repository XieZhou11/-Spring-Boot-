package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
import java.util.List;
/**
 * @param id 申请编号
 * @param orderId 原订单编号
 * @param orderNo 原订单号
 * @param buyerId 申请买家
 * @param creatorId 本单创作者
 * @param applicationType 普通或系统退款
 * @param originalOrderStatus 售后前状态
 * @param reasonCode 初始申请原因
 * @param description 原始说明
 * @param imageIds 初始凭证编号
 * @param status 处理状态
 * @param createRequestKey 原申请请求键
 * @param version 已提交新补证版本
 * @param createdAt 受理时刻
 * @param finishedAt 本次结束时刻
 * @param handlerId 处理管理员
 * @param decisionReason 处理结论依据
 * @param returnRequired 是否需退货
 * @param returnTrackingNo 核实退回运单
 * @param returnConfirmedAt 服务器核实时刻
 * @param returnConfirmedBy 核实管理员
 * @param noReturnBasis 无需退货依据
 * @param canSupplement 当前是否允许补证
 * @param canWithdraw 当前买家能否撤回
 * @param refundAmount 服务器原成功实付金额
 * @param conversationId 原关联会话
 */
public record RefundApplicationVO(String id,String orderId,String orderNo,String buyerId,String creatorId,String applicationType,String originalOrderStatus,String reasonCode,String description,List<String> imageIds,String status,String createRequestKey,long version,OffsetDateTime createdAt,OffsetDateTime finishedAt,String handlerId,String decisionReason,Boolean returnRequired,String returnTrackingNo,OffsetDateTime returnConfirmedAt,String returnConfirmedBy,String noReturnBasis,boolean canSupplement,boolean canWithdraw,String refundAmount,String conversationId) {}
