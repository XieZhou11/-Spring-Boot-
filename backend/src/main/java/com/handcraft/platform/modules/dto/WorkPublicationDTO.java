package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 管理员下架附具体原因。 */
@Getter @Setter
public class WorkPublicationDTO extends WorkVersionDTO {
    /** 下架原因，作者下架不使用此请求。 */
    @NotBlank @Size(max=1000) private String reason;
}
