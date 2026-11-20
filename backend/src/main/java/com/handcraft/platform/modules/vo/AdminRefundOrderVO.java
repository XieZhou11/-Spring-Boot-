package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
import java.util.*;
/** 管理员独立只读订单视图，不返回收款账户或交易双方写入资格。
 * @param id 订单编号 @param orderNo 订单号 @param title 标题快照 @param status 当前状态
 * @param buyerId 买家编号 @param buyerNickname 买家昵称 @param creatorId 创作者编号 @param creatorNickname 创作者昵称
 * @param requestId 需求编号 @param quoteId 中标报价编号 @param totalAmount 原成交金额
 * @param agreementSnapshot 原约定快照 @param addressSnapshot 查证必要地址快照 @param paidAt 原付款时刻
 * @param startedAt 开工时刻 @param shipDeadlineAt 原发货截止 @param trackingNo 当前运单
 * @param shippedAt 原发货时刻 @param autoConfirmAt 当前自动收货时刻 @param originalCompletedAt 原完成时刻
 * @param conversationId 关联原会话 @param payment 原成功付款摘要 @param settlement 结算金额及状态摘要 @param progressNodes 只读节点及历次进度 */
public record AdminRefundOrderVO(String id,String orderNo,String title,String status,String buyerId,String buyerNickname,String creatorId,String creatorNickname,String requestId,String quoteId,String totalAmount,Map<String,Object> agreementSnapshot,Map<String,Object> addressSnapshot,OffsetDateTime paidAt,OffsetDateTime startedAt,OffsetDateTime shipDeadlineAt,String trackingNo,OffsetDateTime shippedAt,OffsetDateTime autoConfirmAt,OffsetDateTime originalCompletedAt,String conversationId,Map<String,Object> payment,Map<String,Object> settlement,List<OrderProgressNodeVO> progressNodes) {}
