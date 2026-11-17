package com.handcraft.platform.modules.dto;

import java.math.BigDecimal;
import java.util.List;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

/** 报价方案提交后不可覆盖，修改使用撤回重报。 */
@Getter @Setter
public class QuoteCreateDTO extends RequestKeyDTO {
    /** 商品报价金额，人民币元。 */
    @NotNull @DecimalMin("50.00") @DecimalMax("50000.00") @Digits(integer=5,fraction=2)
    private BigDecimal goodsAmount;
    /** 包含开工等待的自然日工期。 */
    @NotNull @Min(3) @Max(180)
    private Integer durationDays;
    /** 材料及工艺方案。 */
    @NotBlank @Size(min=30,max=1000)
    private String proposal;
    /** 可选材料与修改约定。 */
    @Size(max=10000)
    private String additionalAgreement;
    /** 本人上传的最多五张报价图片。 */
    @NotNull @Size(max=5)
    private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> imageIds=List.of();
}
