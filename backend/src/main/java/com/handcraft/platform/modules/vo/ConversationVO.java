package com.handcraft.platform.modules.vo;
import java.util.List;
import java.time.*;
/**
 * @param id 会话编号
 * @param requestId 需求编号
 * @param orderId 订单编号
 * @param requestTitle 需求标题
 * @param requestStatus 需求有效状态
 * @param otherUserId 另一方账号编号
 * @param otherNickname 另一方昵称
 * @param unreadCount 本人未读消息数
 * @param lastMessageAt 最近消息时间
 * @param lastMessageSeq 最新消息序号
 * @param readSeq 本人已读序号
 * @param canSend 是否可发送
 * @param sendDisabledReason 禁止发送原因
 * @param archivedAt 归档时间
 * @param archiveReason 归档原因
 */
public record ConversationVO(String id,String requestId,String orderId,String requestTitle,String requestStatus,String otherUserId,String otherNickname,long unreadCount,OffsetDateTime lastMessageAt,String lastMessageSeq,String readSeq,boolean canSend,String sendDisabledReason,OffsetDateTime archivedAt,String archiveReason) {}
