package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
/** 普通售后只接受申请依据，金额及处理状态完全由服务器决定。 */
@Getter @Setter
public class RefundApplicationDTO {
    /** 买家范围幂等请求键。 */ @NotBlank @Size(max=64) @Pattern(regexp="[A-Za-z0-9_-]{8,64}") private String requestKey;
    /** 固定申请原因代码。 */ @NotBlank @Pattern(regexp="MISMATCH|QUALITY|SHIPPING_DELAY|CREATOR_UNABLE|OTHER") private String reasonCode;
    /** 二十至五百字原申请说明。 */ @NotBlank @Size(min=20,max=500) private String description;
    /** 本人上传的本单退款凭证，保持原始顺序。 */ @NotNull @Size(max=3) private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> imageIds=List.of();
}
