package com.handcraft.platform.modules.entity;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** 每邮箱一条最新验证码记录，所有时间按北京时间读写。 */
@Getter
@Setter
public class EmailVerificationCode {
    /** 规范化后的邮箱，唯一索引保证每个邮箱只保留一条最新记录。 */
    private String email;

    /** 本次发送的唯一请求键，阻止较早的 SMTP 回调覆盖新验证码状态。 */
    private String sendRequestKey;

    /** 绑定邮箱和验证码的 HMAC-SHA256 摘要，不存储明文验证码。 */
    private byte[] codeDigest;

    /** 发送状态：SENDING 发送中、SENT 已发送、FAILED 明确失败、UNKNOWN 结果未知。 */
    private String sendStatus;

    /** 北京时间的失效时刻，验证码在该时刻起不可使用。 */
    private LocalDateTime expiresAt;

    /** 成功消费时刻；为空表示尚未消费，须同时满足发送成功且未过期才可使用。 */
    private LocalDateTime usedAt;
}
