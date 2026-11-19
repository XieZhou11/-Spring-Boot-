package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
/** 首次节点图文，同时作为发货图文输入的基础。 */
@Getter @Setter
public class OrderCheckInDTO {
    /** 创作者范围请求键，未知结果重试时保持原值。 */
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") private String requestKey;
    /** 当前阶段完成说明。 */
    @NotBlank @Size(min=5,max=500) private String content;
    /** 当前订单阶段实拍图，保留提交顺序。 */
    @NotNull @Size(min=1,max=6) private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> imageIds;
}
