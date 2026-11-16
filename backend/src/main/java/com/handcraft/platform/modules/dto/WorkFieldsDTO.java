package com.handcraft.platform.modules.dto;
import java.util.List;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 草稿与提交共用字段；必填发布规则由服务层按操作判断。 */
@Getter @Setter
public class WorkFieldsDTO {
    /** 标题，草稿允许不完整。 */
    @Size(max=30,message="标题最多30字")
    private String title;
    /** 末级品类字符串编号。 */
    @Pattern(regexp="[1-9][0-9]{0,18}",message="品类编号无效")
    private String categoryId;
    /** 主图字符串编号，首图是封面。 */
    @NotNull @Size(max=9,message="主图最多9张")
    private List<@Pattern(regexp="[1-9][0-9]{0,18}") String> mainImageIds=List.of();
    /** 可选尺寸图字符串编号。 */
    @NotNull
    private List<@Pattern(regexp="[1-9][0-9]{0,18}") String> specificationImageIds=List.of();
    /** 材质。 */
    @Size(max=20,message="材质最多20字")
    private String material;
    /** 尺寸规格。 */
    @Size(max=10000,message="尺寸规格过长")
    private String specification;
    /** 作品描述。 */
    @Size(max=2000,message="描述最多2000字")
    private String description;
    /** 可选制作过程说明。 */
    @Size(max=1000,message="过程最多1000字")
    private String processDescription;
    /** 是否出售现货。 */
    @NotNull
    private Boolean saleEnabled;
    /** 是否接受定制。 */
    @NotNull
    private Boolean customEnabled;
    /** 条件必填的现货价格。 */
    @DecimalMin("0.01") @DecimalMax("99999.00") @Digits(integer=5,fraction=2)
    private BigDecimal stockPrice;
    /** 条件必填的定制参考天数。 */
    @Min(3) @Max(180)
    private Integer customReferenceDays;
}
