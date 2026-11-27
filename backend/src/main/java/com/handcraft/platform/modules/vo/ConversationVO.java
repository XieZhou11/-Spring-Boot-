package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
/**
 * @param id 会话编号
 * @param requestId 需求编号
 * @param orderId 订单编号
 * @param requestTitle 需求标题
 * @param requestStatus 需求有效状态
 * @param otherUserId 另一方账号编号
 * @param otherNickname 另一方昵称
 * @param otherAvatarUrl 另一方头像短时访问地址，无头像或存储不可用时为 null
 * @param otherAvatarExpiresAt 对方头像地址失效时间，前端据此在到期前重读会话
 * @param unreadCount 本人未读消息数
 * @param lastMessageAt 最近消息时间
 * @param lastMessageSeq 最新消息序号
 * @param readSeq 本人已读序号
 * @param canSend 是否可发送
 * @param sendDisabledReason 禁止发送原因
 * @param archivedAt 归档时间
 * @param archiveReason 归档原因
 * @param orderTitle 关联订单的标题快照，无订单为空
 * @param orderStatus 关联订单的当前有效状态，待付款达到截止时显示已取消但不由GET写库
 * @param orderAmount 关联订单成交金额快照（十进制字符串），无订单为空
 * @param orderCoverImageId 关联现货订单的成交主图编号，无订单或定制订单为空
 * @param canPayOrder 当前用户是否为仍处于有效待付款状态的关联订单买家
 */
public record ConversationVO(String id,String requestId,String orderId,String requestTitle,String requestStatus,
        String otherUserId,String otherNickname,String otherAvatarUrl,OffsetDateTime otherAvatarExpiresAt,
        long unreadCount,OffsetDateTime lastMessageAt,String lastMessageSeq,String readSeq,boolean canSend,
        String sendDisabledReason,OffsetDateTime archivedAt,String archiveReason,String orderTitle,String orderStatus,
        String orderAmount,String orderCoverImageId,boolean canPayOrder) {}
