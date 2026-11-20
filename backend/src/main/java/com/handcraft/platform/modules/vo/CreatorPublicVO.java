package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
import java.util.List;
/** 创作者主页仅展示公开资料和通过认证的省市。 */
public record CreatorPublicVO(
    /** 创作者编号。 */
    String id,
    /** 公开昵称。 */
    String nickname,
    /** 本人公开简介。 */
    String bio,
    /** 头像签名。 */
    String avatarUrl,
    /** 头像签名有效期。 */
    OffsetDateTime avatarExpiresAt,
    /** 已通过认证的主品类。 */
    List<CategoryVO> categories,
    /** 已通过认证的省份。 */
    String province,
    /** 已通过认证的城市。 */
    String city,
    /** 暂停新业务。 */
    boolean paused,
    /** 可见评价平均分，无评价为空。 */
    String averageRating,
    /** 可见评价总数。 */
    long reviewCount,
    /** 四至五星占有效评价的百分比，无评价为空。 */
    String positiveRate,
    /** 完成订单数。 */
    long completedOrderCount,
    /** 当前上架作品数。 */
    long publicWorkCount) {}
