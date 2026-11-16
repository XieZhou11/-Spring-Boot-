package com.handcraft.platform.modules.vo;

/** @param id 通知编号 @param eventType 业务事件类型 @param title 标题 @param content 正文 @param businessReference 需再次鉴权的业务跳转引用 @param readAt 首次已读时间 @param createdAt 创建时间 */
public record NotificationVO(String id,String eventType,String title,String content,java.util.Map<String,String> businessReference,java.time.OffsetDateTime readAt,java.time.OffsetDateTime createdAt) {}
