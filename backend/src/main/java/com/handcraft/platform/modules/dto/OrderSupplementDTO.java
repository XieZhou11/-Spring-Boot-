package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
/** 补充可以纯文字或纯图片，至少一项非空由业务层验证。 */
@Getter @Setter
public class OrderSupplementDTO {
    /** 创作者范围请求键。 */
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") private String requestKey;
    /** 补充说明，纯图片时可为空。 */
    @Size(max=500) private String content="";
    /** 补充实拍图片，纯文字时为空数组。 */
    @NotNull @Size(max=6) private List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> imageIds=List.of();
}
