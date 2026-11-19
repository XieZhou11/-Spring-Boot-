package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 运单号更正以原值避免多端覆盖。 */
@Getter @Setter
public class OrderTrackingDTO {
    /** 创作者范围请求键。 */
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") private String requestKey;
    /** 提交时预期的原运单号。 */
    @NotBlank @Pattern(regexp="[A-Za-z0-9]{8,30}") private String expectedTrackingNo;
    /** 更正后的运单号。 */
    @NotBlank @Pattern(regexp="[A-Za-z0-9]{8,30}") private String trackingNo;
}
