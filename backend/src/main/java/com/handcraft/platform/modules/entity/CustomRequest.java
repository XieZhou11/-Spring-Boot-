package com.handcraft.platform.modules.entity;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 公开和单人定向需求，发布后正文不可变。 */
@Getter @Setter
public class CustomRequest {
    /** 需求编号。 */
    private Long id;
    /** 发布买家编号。 */
    private Long buyerId;
    /** 买家范围创建幂等键。 */
    private String createRequestKey;
    /** 实际变更递增版本。 */
    private Long version;
    /** 草稿逻辑删除时间。 */
    private LocalDateTime deletedAt;
    /** 需求标题。 */
    private String title;
    /** 末级品类字符串编号。 */
    private Long categoryId;
    /** 用途说明。 */
    private String purpose;
    /** 材质偏好，可注明无特殊要求。 */
    private String materialPreference;
    /** 尺寸或规格说明。 */
    private String specification;
    /** 预算下限，单位元。 */
    private BigDecimal budgetMin;
    /** 预算上限，单位元。 */
    private BigDecimal budgetMax;
    /** 期望发货日，不含物流在途时间。 */
    private LocalDate expectedShipDate;
    /** 本人上传的零至九张参考图。 */
    private String referenceImageIds;
    /** 需求细节与验收要求。 */
    private String description;
    /** 公开PUBLIC或单人定向DIRECTED。 */
    private String visibility;
    /** 唯一指定创作者字符串编号。 */
    private Long invitedCreatorId;
    /** 仅作为参考、不占现货的来源作品编号。 */
    private Long sourceWorkId;
    /** 需求持久化状态。 */
    private String status;
    /** 发布时间。 */
    private LocalDateTime publishedAt;
    /** 发布满七天且无有效报价时的期限。 */
    private LocalDateTime noQuoteExpireAt;
    /** 关闭或过期时间。 */
    private LocalDateTime closedAt;
    /** 创建时间。 */
    private LocalDateTime createdAt;
    /** 更新时间。 */
    private LocalDateTime updatedAt;
}
