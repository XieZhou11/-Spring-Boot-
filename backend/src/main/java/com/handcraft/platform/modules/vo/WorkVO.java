package com.handcraft.platform.modules.vo;
import java.time.OffsetDateTime;
import java.util.List;
/** 作品当前展示及管理视图；不含私密入驻资料。 */
public record WorkVO(
    /** 作品编号。 */
    String id,
    /** 作者编号。 */
    String creatorId,
    /** 作者公开昵称。 */
    String creatorNickname,
    /** 作者头像签名地址。 */
    String creatorAvatarUrl,
    /** 头像签名到期时间。 */
    OffsetDateTime creatorAvatarExpiresAt,
    /** 品类编号。 */
    String categoryId,
    /** 从一级到末级的品类名称。 */
    List<String> categoryPath,
    /** 标题。 */
    String title,
    /** 有序主图编号。 */
    List<String> mainImageIds,
    /** 尺寸图编号。 */
    List<String> specificationImageIds,
    /** 材质。 */
    String material,
    /** 规格。 */
    String specification,
    /** 描述。 */
    String description,
    /** 制作过程。 */
    String processDescription,
    /** 出售现货开关。 */
    boolean saleEnabled,
    /** 接受定制开关。 */
    boolean customEnabled,
    /** 现货金额十进制字符串。 */
    String stockPrice,
    /** 定制参考自然日。 */
    Integer customReferenceDays,
    /** 审核状态。 */
    String reviewStatus,
    /** 单件现货状态。 */
    String stockStatus,
    /** 并发版本号。 */
    String version,
    /** 首次提交北京时间。 */
    OffsetDateTime firstSubmittedAt,
    /** 本轮提交北京时间。 */
    OffsetDateTime submittedAt,
    /** 最近上架北京时间。 */
    OffsetDateTime onlineAt,
    /** 创建北京时间。 */
    OffsetDateTime createdAt,
    /** 修改北京时间。 */
    OffsetDateTime updatedAt,
    /** 本人或管理员可见的最近审核原因，公开响应为空。 */
    String reviewReason,
    /** 当前创作者与作品满足可售条件。 */
    boolean purchasable,
    /** 当前创作者与作品满足接受定制条件。 */
    boolean customizable,
    /** 封面签名，无图为空。 */
    ImageVO coverImage,
    /** 授权成品案例来源定制订单，普通作品为空。 */
    String sourceOrderId) {}
