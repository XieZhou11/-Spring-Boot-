package com.handcraft.platform.modules.dto;

import java.time.LocalDate;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

/** 定标只接收选择与确认，金额和方案从报价快照取得。 */
@Getter @Setter
public class AwardDTO extends RequestKeyDTO {
    /** 本次选择的报价编号。 */
    @NotBlank @Pattern(regexp="[1-9][0-9]{0,18}")
    private String quoteId;
    /** 本人确认使用的收货地址编号。 */
    @NotBlank @Pattern(regexp="[1-9][0-9]{0,18}")
    private String addressId;
    /** 页面确认的预计发货日，跨日变化须重新确认。 */
    @NotNull
    private LocalDate confirmedEstimatedShipDate;
}
