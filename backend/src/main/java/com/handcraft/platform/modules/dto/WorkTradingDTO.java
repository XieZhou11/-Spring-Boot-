package com.handcraft.platform.modules.dto;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 独立交易设置不改变正文审核状态及历史现货锁定状态。 */
@Getter @Setter
public class WorkTradingDTO extends WorkVersionDTO {
    /** 出售现货开关。 */
    @NotNull private Boolean saleEnabled;
    /** 接受定制开关。 */
    @NotNull private Boolean customEnabled;
    /** 出售现货时必填的价格。 */
    @DecimalMin("0.01") @DecimalMax("99999.00") @Digits(integer=5,fraction=2) private BigDecimal stockPrice;
    /** 接受定制时必填的参考自然日。 */
    @Min(3) @Max(180) private Integer customReferenceDays;
}
