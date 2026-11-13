package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;

/**
 * 只返回失效时刻，不向调用方回传验证码或其摘要。
 *
 * @param expiresAt 本次验证码的失效时刻，包含北京时间偏移
 */
public record VerificationCodeVO(OffsetDateTime expiresAt) {}
