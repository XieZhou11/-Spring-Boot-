package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.ArrayList;
import lombok.Getter;
import lombok.Setter;
/** 首次节点图文，同时作为发货图文输入的基础。 */
@Getter @Setter
public class OrderCheckInDTO {
    /** 创作者范围请求键，未知结果重试时保持原值。 */
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") private String requestKey;
    /** 定制阶段完成说明；现货发货不提交制作过程内容。 */
    @Size(max=500) private String content="";
    /** 定制阶段须附 1 至 6 张实拍图，现货发货可使用默认空列表。 */
    @NotNull(message = "图片列表须为数组")
    @Size(max=6) private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> imageIds=new ArrayList<>();
}
