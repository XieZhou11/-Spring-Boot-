package com.handcraft.platform.modules.dto;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 列表组合筛选；公开接口固定每页20条。 */
@Getter @Setter
public class WorkQueryDTO {
    /** 标题和描述关键词。 */
    @Size(max=100) private String keyword;
    /** 品类编号，一级包含其二级。 */
    @Pattern(regexp="[1-9][0-9]{0,18}") private String categoryId;
    /** 公开作品作者编号。 */
    @Pattern(regexp="[1-9][0-9]{0,18}") private String creatorId;
    /** 最低可购现货价格。 */
    @DecimalMin("0") @DecimalMax("99999") @Digits(integer=5,fraction=2) private BigDecimal minPrice;
    /** 最高可购现货价格。 */
    @DecimalMin("0") @DecimalMax("99999") @Digits(integer=5,fraction=2) private BigDecimal maxPrice;
    /** 是否当前可直购。 */
    private Boolean purchasable;
    /** 是否当前可接受定制。 */
    private Boolean customizable;
    /** 公开排序。 */
    @Pattern(regexp="LATEST|PRICE_ASC|PRICE_DESC") private String sort="LATEST";
    /** 管理列表审核状态。 */
    @Pattern(regexp="ALL|DRAFT|PENDING|ONLINE|REJECTED|OFFLINE") private String status;
    /** 页码。 */
    @Min(1) @Max(1000000) private int page=1;
    /** 管理列表每页数量，公开固定20。 */
    @Min(1) @Max(50) private int size=20;
}
