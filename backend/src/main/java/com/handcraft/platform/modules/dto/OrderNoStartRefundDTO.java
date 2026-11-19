package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
/** 无责退款不接受客户端金额或申请类型。 */
@Getter @Setter
public class OrderNoStartRefundDTO {
    /** 二十至五百字申请说明。 */
    @NotBlank @Size(min=20,max=500) private String description;
    /** 可选的本单退款凭证。 */
    @NotNull @Size(max=3) private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> imageIds=List.of();
}
