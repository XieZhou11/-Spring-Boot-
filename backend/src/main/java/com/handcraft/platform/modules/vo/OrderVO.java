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
 * @param addressSnapshot 买家详情及创作者待发货或已发货历史的必要地址快照
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
 * @param shipDate 现货为发货截止的北京时间日期，定制为约定发货日，未付款为空
 * @param shipDeadlineAt 付款时固定的排他截止，现货为付款后四十八小时，定制为约定发货日次日零时
 * @param paymentPreview 仅买家待付款详情的条款及日期预览
 * @param payment 仅订单双方详情的原成功付款信息
 * @param settlement 仅创作者详情的脱敏结算信息
 * @param progressNodes 仅详情的固定节点计划，列表为空数组
 * @param startedAt 首次开工时间
 * @param startDeadlineAt 已付款定制的开工截止，现货或未付款为空
 * @param trackingNo 当前有效运单号
 * @param shippedAt 首次发货时间
 * @param autoConfirmAt 当前自动收货时刻
 * @param originalCompletedAt 首次完成时间，售后不重开窗口
 * @param serverTime 本次只读快照的北京时刻
 * @param canStart 当前创作者能否确认开工
 * @param canShip 当前创作者能否包装发货
 * @param canCorrectTracking 当前创作者能否更正运单
 * @param canConfirmReceipt 当前买家能否确认收货
 * @param canRequestNoStartRefund 当前买家能否无责退款
 * @param shippingOverdue 当前仍未发货且已达固定发货截止
 * @param trackingHistory 仅详情的完整运单更正历史
 * @param noStartRefund 仅详情的已执行无责退款结果
 * @param canRequestRefund 当前买家能否发起普通售后
 * @param refundWindowEndsAt 原完成后七天的排他申请截止
 * @param currentRefund 仅详情的当前处理中申请摘要，不含补证
 * @param publicationConsentStatus 定制成品公开授权状态
 * @param publicationRequestedAt 创作者申请公开时间
 * @param publicationRespondedAt 买家明确回复时间
 * @param canRequestPublicationConsent 当前创作者能否申请公开授权
 * @param canRespondPublicationConsent 当前买家能否回复公开授权
 */
public record OrderVO(String id, String orderNo, String orderType, String buyerId, String buyerNickname, String creatorId, String creatorNickname, String requestId, String quoteId, String status, String title, String totalAmount, Integer durationDays, Map<String,Object> agreementSnapshot, Map<String,Object> addressSnapshot, OffsetDateTime createdAt, OffsetDateTime payDeadlineAt, OffsetDateTime cancelledAt, String cancelReason, boolean owned, boolean canCancel, String conversationId, List<OrderHistoryVO> history,boolean canPay,String paidAmount,OffsetDateTime paidAt,OffsetDateTime termsConfirmedAt,LocalDate shipDate,OffsetDateTime shipDeadlineAt,OrderPaymentPreviewVO paymentPreview,OrderPaymentVO payment,OrderSettlementVO settlement,List<OrderProgressNodeVO> progressNodes,OffsetDateTime startedAt,OffsetDateTime startDeadlineAt,String trackingNo,OffsetDateTime shippedAt,OffsetDateTime autoConfirmAt,OffsetDateTime originalCompletedAt,OffsetDateTime serverTime,boolean canStart,boolean canShip,boolean canCorrectTracking,boolean canConfirmReceipt,boolean canRequestNoStartRefund,boolean shippingOverdue,List<OrderTrackingHistoryVO> trackingHistory,OrderNoStartRefundVO noStartRefund,boolean canRequestRefund,OffsetDateTime refundWindowEndsAt,RefundApplicationVO currentRefund,String publicationConsentStatus,OffsetDateTime publicationRequestedAt,OffsetDateTime publicationRespondedAt,boolean canRequestPublicationConsent,boolean canRespondPublicationConsent) {}
