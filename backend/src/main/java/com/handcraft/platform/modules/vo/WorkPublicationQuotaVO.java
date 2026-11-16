package com.handcraft.platform.modules.vo;

/** 首次提交额度按北京时间自然日统计。 */
public record WorkPublicationQuotaVO(
    /** 今日首次提交数量，包含已删作品。 */
    long used,
    /** 自然日额度。 */
    int limit,
    /** 剩余额度。 */
    long remaining,
    /** 当前资格和剩余额度允许新作品提交。 */
    boolean canPublish,
    /** 不能提交原因，允许时为空。 */
    String reason) {}
