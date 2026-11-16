package com.handcraft.platform.modules.entity;

import lombok.Getter;
import lombok.Setter;

/** 持久化系统通知，不包含回复能力。 */
@Getter @Setter
public class SystemNotification {
    /** 通知编号。 */
    private Long id;
    /** 接收人编号。 */
    private Long recipientId;
    /** 业务事件类型。 */
    private String eventType;
    /** 接收人范围的事件去重键。 */
    private String eventKey;
    /** 通知标题。 */
    private String title;
    /** 通知正文，不含收款账号。 */
    private String content;
    /** 业务对象JSON引用。 */
    private String businessReference;
    /** 首次已读时间。 */
    private java.time.LocalDateTime readAt;
    /** 创建时间。 */
    private java.time.LocalDateTime createdAt;
}
