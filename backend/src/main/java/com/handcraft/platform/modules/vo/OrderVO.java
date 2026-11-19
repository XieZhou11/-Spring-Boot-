package com.handcraft.platform.modules.vo;

import java.util.List;
import java.util.Map;
import java.time.OffsetDateTime;
import java.time.LocalDate;

/**
 * @param id 订单编号
 * @param orderNo 对外订单号
 * @param orderType 履约类型
 * @param buyerId 买家编号
 * @param buyerNickname 买家昵称
 * @param creatorId 创作者编号
 * @param creatorNickname 创作者昵称
 * @param requestId 来源需求编号
 * @param quoteId 中标报价编号
 * @param status 按服务端时间判断的交易状态
 * @param title 标题快照
 * @param totalAmount 成交金额快照
 * @param durationDays 工期快照
 * @param agreementSnapshot 不可变方案快照
 * @param addressSnapshot 买家可读完整地址，创作者为空
 * @param createdAt 建单时间
 * @param payDeadlineAt 付款截止时间
 * @param cancelledAt 取消时间
 * @param cancelReason 取消原因
 * @param owned 当前用户是否买家
 * @param canCancel 是否允许买家取消
 * @param conversationId 关联会话编号
 * @param history 业务操作历史
 * @param canPay 当前买家是否可付款
 * @param paidAmount 原成功实付金额，未付为空
 * @param paidAt 原成功付款时间
 * @param termsConfirmedAt 原付款条款确认时间
 * @param shipDate 支付固定的约定发货日
 * @param shipDeadlineAt 发货日次日零时的排他截止上界
 * @param paymentPreview 仅买家待付款详情的条款及日期预览
 * @param payment 仅订单双方详情的原成功付款信息
 * @param settlement 仅创作者详情的脱敏结算信息
 * @param progressNodes 仅详情的固定节点计划，列表为空数组
 */
public record OrderVO(String id, String orderNo, String orderType, String buyerId, String buyerNickname, String creatorId, String creatorNickname, String requestId, String quoteId, String status, String title, String totalAmount, Integer durationDays, Map<String,Object> agreementSnapshot, Map<String,Object> addressSnapshot, OffsetDateTime createdAt, OffsetDateTime payDeadlineAt, OffsetDateTime cancelledAt, String cancelReason, boolean owned, boolean canCancel, String conversationId, List<OrderHistoryVO> history,boolean canPay,String paidAmount,OffsetDateTime paidAt,OffsetDateTime termsConfirmedAt,LocalDate shipDate,OffsetDateTime shipDeadlineAt,OrderPaymentPreviewVO paymentPreview,OrderPaymentVO payment,OrderSettlementVO settlement,List<OrderProgressNodeVO> progressNodes) {}
