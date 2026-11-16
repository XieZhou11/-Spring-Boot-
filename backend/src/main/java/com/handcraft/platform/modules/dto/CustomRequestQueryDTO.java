package com.handcraft.platform.modules.dto;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 需求列表筛选，公开大厅每页固定二十条。 */
@Getter @Setter
public class CustomRequestQueryDTO {
    /** 按末级或主品类筛选。 */
    @Pattern(regexp="[1-9][0-9]{0,18}") private String categoryId;
    /** 预算交集的最低金额。 */
    @DecimalMin("0") @DecimalMax("50000") @Digits(integer=5,fraction=2) private BigDecimal minBudget;
    /** 预算交集的最高金额。 */
    @DecimalMin("0") @DecimalMax("50000") @Digits(integer=5,fraction=2) private BigDecimal maxBudget;
    /** 发布时间起点，包含该时刻。 */
    private OffsetDateTime publishedAfter;
    /** 发布时间终点，不包含该时刻。 */
    private OffsetDateTime publishedBefore;
    /** 是否浏览本人主品类之外的公开需求。 */
    private boolean allCategories;
    /** 本人列表或邀约的状态筛选。 */
    @Pattern(regexp="ALL|DRAFT|OPEN|QUOTING|AWARDED|IN_TRADE|COMPLETED|CLOSED|EXPIRED") private String status;
    /** 从一开始的页码。 */
    @Min(1) @Max(1000000) private int page=1;
    /** 本人列表每页数量，大厅忽略并固定二十条。 */
    @Min(1) @Max(50) private int size=20;
}
