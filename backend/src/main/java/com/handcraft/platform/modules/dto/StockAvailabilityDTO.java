package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

/** 作者确认原成品仍可销售并恢复单件现货直购。 */
@Getter
@Setter
public class StockAvailabilityDTO extends WorkVersionDTO {
    /** 当前售出关联的原现货订单编号。 */
    @NotBlank
    @Pattern(regexp="[1-9][0-9]{0,18}", message="请输入有效的原订单编号")
    @DecimalMax(value="9223372036854775807", message="原订单编号超出范围")
    private String originalOrderId;

    /** 确认同一件成品未发出或已退回，且仍可出售。 */
    @NotBlank
    @Pattern(regexp="NOT_SHIPPED|RETURNED", message="请选择原成品的可售确认依据")
    private String confirmation;

    /** 恢复直购后使用的现货售价。 */
    @NotNull
    @DecimalMin("0.01")
    @DecimalMax("99999.00")
    @Digits(integer=5, fraction=2)
    private BigDecimal stockPrice;
}
