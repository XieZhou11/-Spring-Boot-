package com.handcraft.platform.modules.entity;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;
/** 作品当前状态；不可变历史存入操作日志。 */
@Getter @Setter
public class Work {
    /** 作品编号。 */
    private Long id;
    /** 作者账号编号。 */
    private Long creatorId;
    /** 所属末级品类。 */
    private Long categoryId;
    /** 作者范围内创建幂等键。 */
    private String createRequestKey;
    /** 乐观版本号，每次实际修改递增。 */
    private Long version;
    /** 作品标题。 */
    private String title;
    /** 有序主图JSON字符串编号数组。 */
    private String mainImageIds;
    /** 尺寸图片JSON字符串编号数组。 */
    private String specificationImageIds;
    /** 制作材质。 */
    private String material;
    /** 尺寸规格。 */
    private String specification;
    /** 作品正文。 */
    private String description;
    /** 制作过程。 */
    private String processDescription;
    /** 出售现货开关。 */
    private boolean saleEnabled;
    /** 接受定制开关。 */
    private boolean customEnabled;
    /** 现货售价。 */
    private BigDecimal stockPrice;
    /** 定制参考自然日。 */
    private Integer customReferenceDays;
    /** 展示审核状态。 */
    private String reviewStatus;
    /** 单件现货状态，不能通过开关重置。 */
    private String stockStatus;
    /** 授权成品案例来源订单。 */
    private Long sourceOrderId;
    /** 首次提交北京时间，删除不返还额度。 */
    private LocalDateTime firstSubmittedAt;
    /** 本轮提交北京时间。 */
    private LocalDateTime submittedAt;
    /** 最近上架时间。 */
    private LocalDateTime onlineAt;
    /** 逻辑删除时间。 */
    private LocalDateTime deletedAt;
    /** 创建时间。 */
    private LocalDateTime createdAt;
    /** 最后修改时间。 */
    private LocalDateTime updatedAt;
}
