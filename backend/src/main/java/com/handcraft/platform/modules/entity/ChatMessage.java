package com.handcraft.platform.modules.entity;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 消息保存成功后才推送，重试不新增序号。 */
@Getter @Setter
public class ChatMessage {
    /** 全局唯一消息编号。 */
    private Long id;
    /** 会话编号。 */
    private Long conversationId;
    /** 会话内递增序号。 */
    private Long seqNo;
    /** 登录凭证确定的发送人。 */
    private Long senderId;
    /** 发送人范围幂等键。 */
    private String clientMessageKey;
    /** 可空文字。 */
    private String content;
    /** 零至三张图片的JSON字符串编号数组。 */
    private String imageIds;
    /** 服务器保存时间。 */
    private LocalDateTime createdAt;
}
