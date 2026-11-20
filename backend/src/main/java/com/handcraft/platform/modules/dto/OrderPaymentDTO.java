package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

/** 支付只接收条款和日期确认，成交金额及幂等键由服务端确定。 */
@Getter @Setter
public class OrderPaymentDTO {
    /** 买家明确同意当前定制支付条款。 */
    @NotNull @AssertTrue(message="请确认定制支付条款")
    private Boolean termsConfirmed;
    /** 买家阅读的订单类型对应条款版本，与服务端预览一致。 */
    @NotBlank @Size(max=64)
    private String termsVersion;
    /** 定制买家确认的发货日；现货订单按支付时刻起48小时计算，无需提交日期。 */
    private LocalDate confirmedShipDate;
}
