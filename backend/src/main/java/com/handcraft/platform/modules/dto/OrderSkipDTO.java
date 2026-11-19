package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 仅打样节点可跳过，原因及详细说明分别保存。 */
@Getter @Setter
public class OrderSkipDTO {
    /** 创作者范围请求键。 */
    @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") private String requestKey;
    /** 至少十字的不适用说明。 */
    @NotBlank @Size(min=10,max=500) private String content;
    /** 跳过原因。 */
    @NotBlank @Size(max=500) private String skipReason;
}
